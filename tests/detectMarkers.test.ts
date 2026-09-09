import { describe, expect, it } from 'vitest'
import { GRID_PRESETS, computeLayout } from '../src/domain/layout'
import { applySimilarity, detectMarkers, findMarkerNear, labelComponents, otsu, similarityFromQr } from '../src/domain/scan/detectMarkers'
import type { RgbaImage } from '../src/domain/scan/rgba'

const layout = computeLayout({ grid: GRID_PRESETS['2x2'], dims: { width: 1920, height: 1080 } })

/**
 * Paint a page onto a synthetic scan: white paper, black corner markers
 * (solid squares with a lighter inner pattern), rotated by `deg` and scaled
 * to `pxPerMm`, offset by `offset` px.
 */
function syntheticScan(pxPerMm: number, deg: number, offset: { x: number; y: number }, opts: { skipCorner?: number; noise?: boolean } = {}) {
  const a = (deg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const toPx = (p: { x: number; y: number }) => ({
    x: offset.x + (p.x * cos - p.y * sin) * pxPerMm,
    y: offset.y + (p.x * sin + p.y * cos) * pxPerMm,
  })
  const toMm = (x: number, y: number) => {
    const dx = (x - offset.x) / pxPerMm
    const dy = (y - offset.y) / pxPerMm
    return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos }
  }
  // Generous canvas so rotated pages stay inside the image.
  const W = Math.ceil((layout.pageSize.w + 90) * pxPerMm)
  const H = Math.ceil((layout.pageSize.h + 90) * pxPerMm)
  const data = new Uint8ClampedArray(W * H * 4)
  let seed = 7
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const mm = toMm(x + 0.5, y + 0.5)
      let v = 245
      if (opts.noise) v = 235 + rnd() * 20
      const onPage = mm.x >= 0 && mm.x <= layout.pageSize.w && mm.y >= 0 && mm.y <= layout.pageSize.h
      if (!onPage) v = 200
      for (const m of layout.markers) {
        if (m.corner === opts.skipCorner) continue
        const r = m.rect
        if (mm.x >= r.x && mm.x <= r.x + r.w && mm.y >= r.y && mm.y <= r.y + r.h) {
          // Border dark; interior a checker so the blob is not fully filled.
          const u = (mm.x - r.x) / r.w
          const w = (mm.y - r.y) / r.h
          const border = u < 0.125 || u > 0.875 || w < 0.125 || w > 0.875
          const cell = (Math.floor(u * 8) + Math.floor(w * 8)) % 2 === 0
          v = border || cell ? 20 : 240
        }
      }
      // QR: solid dark square where the QR goes (content does not matter for detection).
      const q = layout.qrRect
      if (mm.x >= q.x && mm.x <= q.x + q.w && mm.y >= q.y && mm.y <= q.y + q.h) v = 30
      const i = (y * W + x) * 4
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    }
  }
  const q = layout.qrRect
  const qr = {
    topLeft: toPx({ x: q.x, y: q.y }),
    topRight: toPx({ x: q.x + q.w, y: q.y }),
    bottomRight: toPx({ x: q.x + q.w, y: q.y + q.h }),
    bottomLeft: toPx({ x: q.x, y: q.y + q.h }),
  }
  const image: RgbaImage = { width: W, height: H, data }
  return { image, qr, toPx }
}

describe('otsu / labelComponents', () => {
  it('separates two clusters', () => {
    const hist = new Uint32Array(256)
    hist[20] = 100
    hist[220] = 100
    const t = otsu(hist, 200)
    expect(t).toBeGreaterThanOrEqual(20)
    expect(t).toBeLessThan(220)
  })
  it('labels separate blobs with bounding boxes', () => {
    const w = 8
    const h = 4
    const bin = new Uint8Array([
      1, 1, 0, 0, 0, 0, 1, 0,
      1, 1, 0, 0, 0, 0, 1, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 1, 1, 1, 0, 0,
    ])
    const blobs = labelComponents(bin, w, h)
    expect(blobs).toHaveLength(3)
    expect(blobs[0]).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 1, area: 4 })
  })
})

describe('similarityFromQr', () => {
  it('maps mm to px with rotation and scale', () => {
    const { qr, toPx } = syntheticScan(4, 3, { x: 50, y: 40 })
    const s = similarityFromQr(layout.qrRect, qr)
    expect(s.scale).toBeCloseTo(4, 6)
    for (const m of layout.markers) {
      const p = applySimilarity(s, m.center)
      const truth = toPx(m.center)
      expect(p.x).toBeCloseTo(truth.x, 4)
      expect(p.y).toBeCloseTo(truth.y, 4)
    }
  })
})

describe('findMarkerNear', () => {
  it('finds a rotated square near the prediction', () => {
    const px = 4
    const { image, toPx } = syntheticScan(px, 5, { x: 60, y: 70 })
    const m = layout.markers[2]
    const truth = toPx(m.center)
    const hit = findMarkerNear(image, { x: truth.x + 15, y: truth.y - 10 }, 10 * px, 60)
    expect(hit).not.toBeNull()
    expect(Math.hypot((hit as { center: { x: number } }).center.x - truth.x, (hit as { center: { y: number } }).center.y - truth.y)).toBeLessThan(1.5)
  })
  it('returns null on blank paper', () => {
    const { image } = syntheticScan(4, 0, { x: 40, y: 40 })
    expect(findMarkerNear(image, { x: image.width / 2, y: image.height / 2 }, 40, 60)).toBeNull()
  })
})

describe('detectMarkers', () => {
  it.each([
    [4, 0, { x: 40, y: 40 }],
    [4, 2.5, { x: 60, y: 30 }],
    [6, -3, { x: 90, y: 80 }],
    [3, 8, { x: 120, y: 30 }],
  ])('finds all four markers at %d px/mm rotated %d deg', (pxPerMm, deg, offset) => {
    const { image, qr, toPx } = syntheticScan(pxPerMm, deg, offset, { noise: true })
    const r = detectMarkers(image, layout, qr)
    expect(r.found).toEqual([0, 1, 2, 3])
    expect(r.pxPerMm).toBeCloseTo(pxPerMm, 5)
    for (const m of layout.markers) {
      const truth = toPx(m.center)
      const got = r.corners[m.corner] as { x: number; y: number }
      expect(Math.hypot(got.x - truth.x, got.y - truth.y)).toBeLessThan(1.5)
    }
  })

  it('reports a missing marker instead of inventing one', () => {
    const { image, qr } = syntheticScan(4, 1, { x: 40, y: 40 }, { skipCorner: 3 })
    const r = detectMarkers(image, layout, qr)
    expect(r.found).toEqual([0, 1, 2])
    expect(r.corners[3]).toBeUndefined()
  })
})
