import { describe, expect, it } from 'vitest'
import {
  CORNERS,
  GRID_PRESETS,
  LAYOUT_CONSTANTS as C,
  chooseOrientation,
  coerceGridPreset,
  computeLayout,
  fitRect,
  formatGrid,
  gridPresetsAround,
  gridPresetsFor,
  mmToPt,
  mmToPx,
  parseGrid,
  rectContains,
  rectsOverlap,
  type Layout,
} from '../src/domain/layout'

const HD = { width: 1920, height: 1080 }
const VERTICAL = { width: 1080, height: 1920 }
const SQUARE = { width: 1000, height: 1000 }

function expectRectInside(inner: { x: number; y: number; w: number; h: number }, outer: typeof inner) {
  expect(rectContains(outer, inner)).toBe(true)
}

function expectNoOverlapWithReserved(layout: Layout) {
  const reserved = [...layout.markers.map((m) => m.clearRect), layout.qrRect]
  for (const cell of layout.cells) {
    for (const r of reserved) expect(rectsOverlap(cell.box, r)).toBe(false)
  }
}

describe('parseGrid / formatGrid', () => {
  it('round-trips presets', () => {
    for (const [key, grid] of Object.entries(GRID_PRESETS)) {
      expect(formatGrid(grid)).toBe(key)
      expect(parseGrid(key)).toEqual(grid)
    }
  })
  it('rejects garbage', () => {
    expect(parseGrid('')).toBeNull()
    expect(parseGrid('2x')).toBeNull()
    expect(parseGrid('0x2')).toBeNull()
    expect(parseGrid('99x99')).toBeNull()
  })
})

describe('fitRect', () => {
  it('fits a wide aspect by width', () => {
    const r = fitRect({ x: 0, y: 0, w: 100, h: 100 }, 2)
    expect(r).toEqual({ x: 0, y: 25, w: 100, h: 50 })
  })
  it('fits a tall aspect by height', () => {
    const r = fitRect({ x: 10, y: 10, w: 100, h: 100 }, 0.5)
    expect(r).toEqual({ x: 35, y: 10, w: 50, h: 100 })
  })
})

describe('computeLayout: A4 landscape, 2x2, 16:9', () => {
  const layout = computeLayout({ grid: GRID_PRESETS['2x2'], dims: HD })

  it('picks landscape for a wide source', () => {
    expect(layout.orientation).toBe('landscape')
    expect(layout.pageSize).toEqual({ w: 297, h: 210 })
  })

  it('places markers at the four corners, inset by the outer margin', () => {
    expect(layout.markers.map((m) => m.corner)).toEqual([...CORNERS])
    const c = C.outerMargin + C.markerSize / 2
    expect(layout.markers[0].center).toEqual({ x: c, y: c })
    expect(layout.markers[1].center).toEqual({ x: 297 - c, y: c })
    expect(layout.markers[2].center).toEqual({ x: 297 - c, y: 210 - c })
    expect(layout.markers[3].center).toEqual({ x: c, y: 210 - c })
    for (const m of layout.markers) {
      expect(m.rect.w).toBe(C.markerSize)
      expect(m.clearRect.w).toBe(C.markerSize + 2 * C.markerQuietZone)
    }
  })

  it('keeps the QR inside the header and clear of the top-right marker', () => {
    expectRectInside(layout.qrRect, layout.headerRect)
    expect(rectsOverlap(layout.qrRect, layout.markers[1].clearRect)).toBe(false)
    expect(layout.qrRect.w).toBe(C.qrSize)
  })

  it('creates cols*rows cells in reading order', () => {
    expect(layout.cells).toHaveLength(4)
    expect(layout.cells.map((c) => c.index)).toEqual([0, 1, 2, 3])
    const [a, b, c, d] = layout.cells
    expect(b.box.x).toBeGreaterThan(a.box.x)
    expect(b.box.y).toBe(a.box.y)
    expect(c.box.y).toBeGreaterThan(a.box.y)
    expect(c.box.x).toBe(a.box.x)
    expect(d.box.x).toBe(b.box.x)
    expect(d.box.y).toBe(c.box.y)
  })

  it('keeps every cell inside the content area and off the markers and QR', () => {
    for (const cell of layout.cells) expectRectInside(cell.box, layout.contentRect)
    expectRectInside(layout.contentRect, {
      x: 0,
      y: 0,
      w: layout.pageSize.w,
      h: layout.pageSize.h,
    })
    expectNoOverlapWithReserved(layout)
  })

  it('does not overlap cells with each other', () => {
    for (let i = 0; i < layout.cells.length; i++) {
      for (let j = i + 1; j < layout.cells.length; j++) {
        expect(rectsOverlap(layout.cells[i].box, layout.cells[j].box)).toBe(false)
      }
    }
  })

  it('prints images at the source aspect, with the crop inset inside', () => {
    for (const cell of layout.cells) {
      expect(cell.imageRect.w / cell.imageRect.h).toBeCloseTo(16 / 9, 6)
      expectRectInside(cell.imageRect, cell.box)
      expectRectInside(cell.cropRect, cell.imageRect)
      expect(cell.imageRect.w - cell.cropRect.w).toBeCloseTo(2 * C.cropInset, 9)
      expect(cell.labelPos.y).toBeGreaterThanOrEqual(cell.imageRect.y + cell.imageRect.h)
      expect(cell.labelPos.y + C.labelHeight).toBeLessThanOrEqual(cell.box.y + cell.box.h + 1e-9)
    }
  })

  it('gives a usefully large frame (sanity check on the constants)', () => {
    const img = layout.cells[0].imageRect
    expect(img.w).toBeGreaterThan(120)
    expect(img.h).toBeGreaterThan(65)
  })

  it('is deterministic', () => {
    expect(computeLayout({ grid: GRID_PRESETS['2x2'], dims: HD })).toEqual(layout)
  })
})

describe('gridPresetsFor / coerceGridPreset', () => {
  it('offers wide grids for landscape and square video', () => {
    expect(gridPresetsFor(HD)).toEqual(['2x2', '3x3', '4x3'])
    expect(gridPresetsFor(SQUARE)).toEqual(['2x2', '3x3', '4x3'])
  })
  it('offers fewer rows for vertical video, and those cells really are larger', () => {
    expect(gridPresetsFor(VERTICAL)).toEqual(['2x2', '3x2', '4x2'])
    const cell = (key: keyof typeof GRID_PRESETS) => computeLayout({ grid: GRID_PRESETS[key], dims: VERTICAL }).cells[0].imageRect
    expect(cell('3x2').w).toBeGreaterThan(cell('3x3').w)
    expect(cell('4x2').w).toBeGreaterThan(cell('4x3').w)
  })
  it('finds the set a preset belongs to, so the row stays stable before the source is known', () => {
    expect(gridPresetsAround('4x2')).toEqual(['2x2', '3x2', '4x2'])
    expect(gridPresetsAround('3x3')).toEqual(['2x2', '3x3', '4x3'])
    expect(gridPresetsAround('2x2')).toEqual(['2x2', '3x3', '4x3'])
  })
  it('keeps an offered preset as is', () => {
    expect(coerceGridPreset('4x3', HD)).toBe('4x3')
    expect(coerceGridPreset('3x2', VERTICAL)).toBe('3x2')
  })
  it('swaps to the same column count when the orientation changes', () => {
    expect(coerceGridPreset('4x3', VERTICAL)).toBe('4x2')
    expect(coerceGridPreset('3x3', VERTICAL)).toBe('3x2')
    expect(coerceGridPreset('2x2', VERTICAL)).toBe('2x2')
    expect(coerceGridPreset('4x2', HD)).toBe('4x3')
    expect(coerceGridPreset('3x2', HD)).toBe('3x3')
  })
})

describe('computeLayout: other grids and aspects', () => {
  it.each(Object.entries(GRID_PRESETS))('%s keeps cells valid for HD', (_key, grid) => {
    const layout = computeLayout({ grid, dims: HD })
    expect(layout.cells).toHaveLength(grid.cols * grid.rows)
    for (const cell of layout.cells) {
      expectRectInside(cell.box, layout.contentRect)
      expect(cell.imageRect.w).toBeGreaterThan(0)
      expect(cell.cropRect.w).toBeGreaterThan(0)
    }
    expectNoOverlapWithReserved(layout)
  })

  it('picks portrait for a vertical source', () => {
    expect(chooseOrientation(GRID_PRESETS['2x2'], VERTICAL)).toBe('portrait')
    const layout = computeLayout({ grid: GRID_PRESETS['2x2'], dims: VERTICAL })
    expect(layout.pageSize).toEqual({ w: 210, h: 297 })
    for (const cell of layout.cells) expect(cell.imageRect.h / cell.imageRect.w).toBeCloseTo(16 / 9, 6)
    expectNoOverlapWithReserved(layout)
  })

  it('honours an explicit orientation', () => {
    const layout = computeLayout({ grid: GRID_PRESETS['2x2'], dims: HD, orientation: 'portrait' })
    expect(layout.orientation).toBe('portrait')
  })

  it('handles a square source', () => {
    const layout = computeLayout({ grid: GRID_PRESETS['3x3'], dims: SQUARE })
    for (const cell of layout.cells) expect(cell.imageRect.w).toBeCloseTo(cell.imageRect.h, 9)
  })

  it('rejects bad input', () => {
    expect(() => computeLayout({ grid: { cols: 0, rows: 2 }, dims: HD })).toThrow()
    expect(() => computeLayout({ grid: GRID_PRESETS['2x2'], dims: { width: 0, height: 1 } })).toThrow()
  })
})

describe('unit conversion', () => {
  it('converts mm to px and pt', () => {
    expect(mmToPx(25.4, 300)).toBe(300)
    expect(mmToPt(25.4)).toBe(72)
    expect(mmToPx(210, 300)).toBeCloseTo(2480.3, 1)
  })
})
