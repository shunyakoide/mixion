/**
 * Automatic corner-marker detection (v0.2).
 *
 * The QR code on the page is 16 mm wide and jsQR tells us where its corners
 * are on the scan. That gives scale and rotation, so we can predict where the
 * four corner markers should be, threshold a small window around each
 * prediction, and look for a dark square of the right size. No ArUco decoding
 * is needed while the QR is readable.
 */
import { CORNERS, LAYOUT_CONSTANTS, type Corner, type Layout, type Point, type Rect } from '../layout'
import { MARKER_COUNT, MARKER_MODULES, decodeMarkerId, markerModules } from '../markers'
import type { RgbaImage } from './rgba'

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
  /** Bounding box of the dark blob in image px (inclusive). */
  box: { x0: number; y0: number; x1: number; y1: number }
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
    if (!best || score > best.score) best = { center: { x: cx, y: cy }, size, score, box: { x0: x0 + b.minX, y0: y0 + b.minY, x1: x0 + b.maxX, y1: y0 + b.maxY } }
  }
  return best
}

export interface DecodedMarker {
  id: number
  page: number
  corner: Corner
  /** Quarter turns clockwise the printed marker appears turned in the image. */
  turns: 0 | 1 | 2 | 3
  hamming: number
}

/** Rotate a square boolean grid clockwise by one quarter turn. */
function rotateGrid(g: boolean[][]): boolean[][] {
  const n = g.length
  return g.map((_, r) => g.map((__, c) => g[n - 1 - c][r]))
}

let dictionary: { id: number; turns: 0 | 1 | 2 | 3; bits: boolean[] }[] | null = null
/** Every marker in every orientation, as flat inner-module bit lists, built once. */
function markerDictionary() {
  if (dictionary) return dictionary
  dictionary = []
  for (let id = 0; id < MARKER_COUNT; id++) {
    let g = markerModules(id)
    for (let k = 0; k < 4; k++) {
      dictionary.push({ id, turns: k as 0 | 1 | 2 | 3, bits: g.slice(1, -1).flatMap((row) => row.slice(1, -1)) })
      g = rotateGrid(g)
    }
  }
  return dictionary
}

/**
 * Read the marker inside a found square: sample the 8×8 module grid and match
 * it against the dictionary in all four orientations. Null when it is not a
 * clean marker (painted over, wrong blob).
 */
export function decodeMarker(image: RgbaImage, hit: MarkerHit, maxHamming = 4): DecodedMarker | null {
  const { x0, y0, x1, y1 } = hit.box
  const cw = (x1 - x0 + 1) / MARKER_MODULES
  const ch = (y1 - y0 + 1) / MARKER_MODULES
  if (cw < 2 || ch < 2) return null
  const rad = Math.max(0, Math.floor(Math.min(cw, ch) / 4))
  const d = image.data
  const sample = (px: number, py: number) => {
    let sum = 0
    let n = 0
    for (let y = Math.round(py) - rad; y <= Math.round(py) + rad; y++) {
      if (y < 0 || y >= image.height) continue
      for (let x = Math.round(px) - rad; x <= Math.round(px) + rad; x++) {
        if (x < 0 || x >= image.width) continue
        const i = (y * image.width + x) * 4
        sum += (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
        n++
      }
    }
    return n ? sum / n : 255
  }
  const values: number[][] = []
  let lo = 255
  let hi = 0
  for (let r = 0; r < MARKER_MODULES; r++) {
    const row: number[] = []
    for (let c = 0; c < MARKER_MODULES; c++) {
      const v = sample(x0 + (c + 0.5) * cw, y0 + (r + 0.5) * ch)
      row.push(v)
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    values.push(row)
  }
  if (hi - lo < 40) return null
  const t = (lo + hi) / 2
  const dark = values.map((row) => row.map((v) => v <= t))
  // The border must be black; tolerate a couple of modules for dust and skew.
  let borderMisses = 0
  for (let i = 0; i < MARKER_MODULES; i++) {
    if (!dark[0][i]) borderMisses++
    if (!dark[MARKER_MODULES - 1][i]) borderMisses++
    if (i > 0 && i < MARKER_MODULES - 1) {
      if (!dark[i][0]) borderMisses++
      if (!dark[i][MARKER_MODULES - 1]) borderMisses++
    }
  }
  if (borderMisses > 2) return null
  const bits = dark.slice(1, -1).flatMap((row) => row.slice(1, -1))
  let best: DecodedMarker | null = null
  for (const entry of markerDictionary()) {
    let h = 0
    for (let i = 0; i < bits.length && h <= maxHamming; i++) if (bits[i] !== entry.bits[i]) h++
    if (h <= maxHamming && (!best || h < best.hamming)) {
      const { page, corner } = decodeMarkerId(entry.id)
      best = { id: entry.id, page, corner, turns: entry.turns, hamming: h }
    }
  }
  return best
}

export interface BlindDetectResult {
  /** Marker centres keyed by the page corner they decode as (or sit at, when undecodable). */
  corners: Partial<Record<Corner, Point>>
  found: Corner[]
  /** Quarter turns clockwise the image needs to read upright, from the decoded markers; 0 when none decoded. */
  turns: 0 | 1 | 2 | 3
  /** Page number read from the markers, when any decoded. */
  page: number | null
  /** How many markers decoded cleanly. */
  decoded: number
  pxPerMm: number
}

/**
 * Detection without a readable QR: assume the page fills the scan, look for a
 * marker-sized square near each image corner, and read the markers to learn
 * the page number and which way the page is turned. Callers that get
 * `turns !== 0` rotate the image and run this again.
 */
export function detectMarkersBlind(image: RgbaImage, layout: Layout): BlindDetectResult {
  const { pageSize } = layout
  const landscapeImage = image.width >= image.height
  const pw = landscapeImage === pageSize.w >= pageSize.h ? pageSize.w : pageSize.h
  const ph = landscapeImage === pageSize.w >= pageSize.h ? pageSize.h : pageSize.w
  const scale = Math.min(image.width / pw, image.height / ph)
  const markerPx = LAYOUT_CONSTANTS.markerSize * scale
  const inset = (LAYOUT_CONSTANTS.outerMargin + LAYOUT_CONSTANTS.markerSize / 2) * scale
  // Anchor each search to its own image corner so scanner padding on any side does not matter.
  const predicted: Record<Corner, Point> = {
    0: { x: inset, y: inset },
    1: { x: image.width - inset, y: inset },
    2: { x: image.width - inset, y: image.height - inset },
    3: { x: inset, y: image.height - inset },
  }
  const searchPx = 18 * scale
  const votesTurns = [0, 0, 0, 0]
  const votesPage = new Map<number, number>()
  const hits: { at: Corner; hit: MarkerHit; decoded: DecodedMarker | null }[] = []
  for (const at of CORNERS) {
    const hit = findMarkerNear(image, predicted[at], markerPx, searchPx)
    if (!hit) continue
    const decoded = decodeMarker(image, hit)
    if (decoded) {
      // A page turned k quarter turns clockwise shows its corner c at image corner (c + k) % 4; the bits agree.
      const byPosition = (at - decoded.corner + 4) % 4
      if (byPosition !== decoded.turns) continue
      votesTurns[decoded.turns]++
      votesPage.set(decoded.page, (votesPage.get(decoded.page) ?? 0) + 1)
    }
    hits.push({ at, hit, decoded })
  }
  const decodedCount = votesTurns.reduce((a, b) => a + b, 0)
  const pageTurns = decodedCount ? (votesTurns.indexOf(Math.max(...votesTurns)) as 0 | 1 | 2 | 3) : 0
  let page: number | null = null
  for (const [p, n] of votesPage) if (page === null || n > (votesPage.get(page) ?? 0)) page = p
  const corners: Partial<Record<Corner, Point>> = {}
  for (const { at, hit, decoded } of hits) {
    if (decoded && decoded.turns !== pageTurns) continue
    // Undecodable squares count only once the orientation is settled (or nothing decoded at all).
    const corner = decoded ? decoded.corner : (((at - pageTurns + 4) % 4) as Corner)
    if (corners[corner] === undefined) corners[corner] = hit.center
  }
  return {
    corners,
    found: CORNERS.filter((c) => corners[c] !== undefined),
    turns: ((4 - pageTurns) % 4) as 0 | 1 | 2 | 3,
    page,
    decoded: decodedCount,
    pxPerMm: scale,
  }
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
      const decoded = decodeMarker(image, hit)
      // A clean read of some other corner's marker means this square is not ours.
      if (decoded && decoded.corner !== m.corner) continue
      corners[m.corner] = hit.center
      found.push(m.corner)
    }
  }
  return { corners, found, pxPerMm: sim.scale, predicted }
}
