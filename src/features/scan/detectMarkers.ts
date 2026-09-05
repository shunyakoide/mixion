/**
 * Automatic corner-marker detection (v0.2).
 *
 * The QR code on the page is 16 mm wide and jsQR tells us where its corners
 * are on the scan. That gives scale and rotation, so we can predict where the
 * four corner markers should be, threshold a small window around each
 * prediction, and look for a dark square of the right size. No ArUco decoding
 * is needed while the QR is readable.
 */
import { LAYOUT_CONSTANTS, type Corner, type Layout, type Point, type Rect } from '../../domain/layout'
import type { RgbaImage } from './warp'

export interface QrCornersPx {
  topLeft: Point
  topRight: Point
  bottomRight: Point
  bottomLeft: Point
}

/** Rotation + uniform scale + translation from page mm to scan px. */
export interface Similarity {
  scale: number
  cos: number
  sin: number
  originMm: Point
  originPx: Point
}

export function similarityFromQr(qrRectMm: Rect, qr: QrCornersPx): Similarity {
  const top = { x: qr.topRight.x - qr.topLeft.x, y: qr.topRight.y - qr.topLeft.y }
  const left = { x: qr.bottomLeft.x - qr.topLeft.x, y: qr.bottomLeft.y - qr.topLeft.y }
  const scale = (Math.hypot(top.x, top.y) + Math.hypot(left.x, left.y)) / 2 / qrRectMm.w
  const angle = Math.atan2(top.y, top.x)
  const originPx = {
    x: (qr.topLeft.x + qr.topRight.x + qr.bottomRight.x + qr.bottomLeft.x) / 4,
    y: (qr.topLeft.y + qr.topRight.y + qr.bottomRight.y + qr.bottomLeft.y) / 4,
  }
  return {
    scale,
    cos: Math.cos(angle),
    sin: Math.sin(angle),
    originMm: { x: qrRectMm.x + qrRectMm.w / 2, y: qrRectMm.y + qrRectMm.h / 2 },
    originPx,
  }
}

export function applySimilarity(s: Similarity, p: Point): Point {
  const dx = (p.x - s.originMm.x) * s.scale
  const dy = (p.y - s.originMm.y) * s.scale
  return { x: s.originPx.x + dx * s.cos - dy * s.sin, y: s.originPx.y + dx * s.sin + dy * s.cos }
}

/** Otsu threshold over an 8-bit histogram. */
export function otsu(hist: Uint32Array, total: number): number {
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0
  let wB = 0
  let best = 0
  let threshold = 127
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > best) {
      best = between
      threshold = t
    }
  }
  return threshold
}

export interface Blob {
  minX: number
  minY: number
  maxX: number
  maxY: number
  area: number
}

/** Connected components (4-neighbour) of `true` pixels in a binary window. */
export function labelComponents(bin: Uint8Array, w: number, h: number): Blob[] {
  const seen = new Uint8Array(w * h)
  const blobs: Blob[] = []
  const stack: number[] = []
  for (let start = 0; start < w * h; start++) {
    if (!bin[start] || seen[start]) continue
    seen[start] = 1
    stack.push(start)
    const b: Blob = { minX: w, minY: h, maxX: -1, maxY: -1, area: 0 }
    while (stack.length) {
      const i = stack.pop() as number
      const x = i % w
      const y = (i - x) / w
      b.area++
      if (x < b.minX) b.minX = x
      if (x > b.maxX) b.maxX = x
      if (y < b.minY) b.minY = y
      if (y > b.maxY) b.maxY = y
      const n = [i - 1, i + 1, i - w, i + w]
      if (x === 0) n[0] = -1
      if (x === w - 1) n[1] = -1
      for (const j of n) {
        if (j < 0 || j >= w * h || seen[j] || !bin[j]) continue
        seen[j] = 1
        stack.push(j)
      }
    }
    blobs.push(b)
  }
  return blobs
}

export interface MarkerHit {
  center: Point
  /** Side length of the found square in px. */
  size: number
  /** 0..1, higher is a better match to the expected size/shape. */
  score: number
}

/**
 * Look for a dark square of about `markerPx` pixels within `searchPx` of
 * `predicted`. Returns the best candidate or null.
 */
export function findMarkerNear(image: RgbaImage, predicted: Point, markerPx: number, searchPx: number): MarkerHit | null {
  const x0 = Math.max(0, Math.floor(predicted.x - searchPx))
  const y0 = Math.max(0, Math.floor(predicted.y - searchPx))
  const x1 = Math.min(image.width - 1, Math.ceil(predicted.x + searchPx))
  const y1 = Math.min(image.height - 1, Math.ceil(predicted.y + searchPx))
  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  if (w < 4 || h < 4) return null

  const gray = new Uint8Array(w * h)
  const hist = new Uint32Array(256)
  const d = image.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y0 + y) * image.width + (x0 + x)) * 4
      const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
      const v = g | 0
      gray[y * w + x] = v
      hist[v]++
    }
  }
  const t = otsu(hist, w * h)
  const bin = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) bin[i] = gray[i] <= t ? 1 : 0

  let best: MarkerHit | null = null
  for (const b of labelComponents(bin, w, h)) {
    const bw = b.maxX - b.minX + 1
    const bh = b.maxY - b.minY + 1
    const size = (bw + bh) / 2
    const sizeRatio = size / markerPx
    if (sizeRatio < 0.55 || sizeRatio > 1.6) continue
    const aspect = Math.min(bw, bh) / Math.max(bw, bh)
    if (aspect < 0.7) continue
    const fill = b.area / (bw * bh)
    // A marker is a black border with a mostly dark interior: expect roughly 45-95% dark.
    if (fill < 0.35) continue
    const cx = x0 + (b.minX + b.maxX) / 2
    const cy = y0 + (b.minY + b.maxY) / 2
    const dist = Math.hypot(cx - predicted.x, cy - predicted.y) / searchPx
    const score = (1 - Math.min(1, Math.abs(1 - sizeRatio))) * 0.5 + aspect * 0.25 + (1 - dist) * 0.25
    if (!best || score > best.score) best = { center: { x: cx, y: cy }, size, score }
  }
  return best
}

export interface DetectResult {
  corners: Partial<Record<Corner, Point>>
  found: Corner[]
  pxPerMm: number
  /** Where each marker was expected, for debugging/overlay. */
  predicted: Record<Corner, Point>
}

export function detectMarkers(image: RgbaImage, layout: Layout, qr: QrCornersPx): DetectResult {
  const sim = similarityFromQr(layout.qrRect, qr)
  const markerPx = LAYOUT_CONSTANTS.markerSize * sim.scale
  // The similarity is extrapolated from a 16 mm code to the page corners, so allow a wide window.
  const searchPx = Math.max(markerPx * 1.5, 12 * sim.scale)
  const corners: Partial<Record<Corner, Point>> = {}
  const found: Corner[] = []
  const predicted = {} as Record<Corner, Point>
  for (const m of layout.markers) {
    const p = applySimilarity(sim, m.center)
    predicted[m.corner] = p
    const hit = findMarkerNear(image, p, markerPx, searchPx)
    if (hit) {
      corners[m.corner] = hit.center
      found.push(m.corner)
    }
  }
  return { corners, found, pxPerMm: sim.scale, predicted }
}
