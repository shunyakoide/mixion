import { describe, expect, it } from 'vitest'
import {
  applyHomography,
  composeHomography,
  invertHomography,
  pageToScanHomography,
  projectRect,
  reprojectionError,
  solveHomography,
  solveLinear,
  type Homography,
} from '../src/domain/homography'
import { GRID_PRESETS, computeLayout } from '../src/domain/layout'

const square = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

function expectPointClose(a: { x: number; y: number }, b: { x: number; y: number }, digits = 6) {
  expect(a.x).toBeCloseTo(b.x, digits)
  expect(a.y).toBeCloseTo(b.y, digits)
}

describe('solveLinear', () => {
  it('solves a small system', () => {
    expect(solveLinear([[2, 1], [1, 3]], [5, 10])).toEqual([1, 3])
  })
  it('throws on a singular system', () => {
    expect(() => solveLinear([[1, 2], [2, 4]], [1, 2])).toThrow()
  })
})

describe('solveHomography', () => {
  it('returns identity for identical points', () => {
    const h = solveHomography(square, square)
    expect(h.map((v) => Math.round(v * 1e9) / 1e9 + 0)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })
  it('recovers scale + translation', () => {
    const dst = square.map((p) => ({ x: p.x * 100 + 20, y: p.y * 50 + 7 }))
    const h = solveHomography(square, dst)
    expectPointClose(applyHomography(h, { x: 0.5, y: 0.5 }), { x: 70, y: 32 })
  })
  it('recovers rotation', () => {
    const a = Math.PI / 6
    const dst = square.map((p) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) }))
    const h = solveHomography(square, dst)
    expectPointClose(applyHomography(h, { x: 1, y: 1 }), dst[2])
  })
  it('recovers a perspective transform exactly', () => {
    const truth: Homography = [1.2, 0.1, 30, -0.05, 0.9, 12, 0.0004, 0.0002, 1]
    const src = [
      { x: 10, y: 10 },
      { x: 290, y: 12 },
      { x: 285, y: 200 },
      { x: 8, y: 195 },
    ]
    const dst = src.map((p) => applyHomography(truth, p))
    const h = solveHomography(src, dst)
    for (let i = 0; i < 9; i++) expect(h[i]).toBeCloseTo(truth[i], 6)
    expect(reprojectionError(h, src, dst)).toBeLessThan(1e-6)
    expectPointClose(applyHomography(h, { x: 150, y: 100 }), applyHomography(truth, { x: 150, y: 100 }))
  })
  it('rejects collinear points', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]
    expect(() => solveHomography(line, square)).toThrow()
  })
  it('requires exactly four pairs', () => {
    expect(() => solveHomography(square.slice(0, 3), square.slice(0, 3))).toThrow()
  })
})

describe('invertHomography / composeHomography', () => {
  const h: Homography = [1.2, 0.1, 30, -0.05, 0.9, 12, 0.0004, 0.0002, 1]
  it('inverse maps back', () => {
    const inv = invertHomography(h)
    const p = { x: 123, y: 45 }
    expectPointClose(applyHomography(inv, applyHomography(h, p)), p)
  })
  it('compose with inverse is identity', () => {
    const id = composeHomography(h, invertHomography(h))
    const n = id.map((v) => v / id[8])
    expect(n.map((v) => Math.round(v * 1e6) / 1e6 + 0)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })
})

describe('pageToScanHomography', () => {
  const layout = computeLayout({ grid: GRID_PRESETS['2x2'], dims: { width: 1920, height: 1080 } })

  it('maps marker centres to the clicked pixels', () => {
    // A 300dpi scan (11.81 px/mm), slightly rotated and offset.
    const s = 300 / 25.4
    const a = 0.01
    const toPx = (p: { x: number; y: number }) => ({
      x: 40 + s * (p.x * Math.cos(a) - p.y * Math.sin(a)),
      y: 25 + s * (p.x * Math.sin(a) + p.y * Math.cos(a)),
    })
    const corners = {
      0: toPx(layout.markers[0].center),
      1: toPx(layout.markers[1].center),
      2: toPx(layout.markers[2].center),
      3: toPx(layout.markers[3].center),
    }
    const h = pageToScanHomography(layout, corners)
    for (const m of layout.markers) expectPointClose(applyHomography(h, m.center), corners[m.corner], 6)
    // Cell 0's crop rect lands where the same transform says it should.
    const poly = projectRect(h, layout.cells[0].cropRect)
    const c = layout.cells[0].cropRect
    expectPointClose(poly[0], toPx({ x: c.x, y: c.y }), 6)
    expectPointClose(poly[2], toPx({ x: c.x + c.w, y: c.y + c.h }), 6)
  })

  it('absorbs "fit to page" print scaling (markers stay proportional)', () => {
    const shrink = 0.94
    const s = 200 / 25.4
    const toPx = (p: { x: number; y: number }) => ({ x: 100 + s * shrink * p.x, y: 80 + s * shrink * p.y })
    const corners = { 0: toPx(layout.markers[0].center), 1: toPx(layout.markers[1].center), 2: toPx(layout.markers[2].center), 3: toPx(layout.markers[3].center) }
    const h = pageToScanHomography(layout, corners)
    const c = layout.cells[3].cropRect
    expectPointClose(applyHomography(h, { x: c.x, y: c.y }), toPx({ x: c.x, y: c.y }), 6)
  })
})
