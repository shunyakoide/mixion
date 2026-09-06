import { describe, expect, it } from 'vitest'
import { GRID_PRESETS, computeLayout, type Corner } from '../src/domain/layout'
import { markerId, markerModules } from '../src/domain/markers'
import { decodeMarker, detectMarkersBlind, findMarkerNear } from '../src/features/scan/detectMarkers'
import type { RgbaImage } from '../src/features/scan/warp'

const layout = computeLayout({ grid: GRID_PRESETS['2x2'], dims: { width: 1920, height: 1080 } })

function blank(width: number, height: number, v = 240): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = v
    data[i + 3] = 255
  }
  return { width, height, data }
}

function paintMarker(img: RgbaImage, id: number, x: number, y: number, cell: number) {
  const g = markerModules(id)
  for (let r = 0; r < g.length; r++) {
    for (let c = 0; c < g.length; c++) {
      if (!g[r][c]) continue
      for (let yy = 0; yy < cell; yy++) {
        for (let xx = 0; xx < cell; xx++) {
          const i = ((y + r * cell + yy) * img.width + (x + c * cell + xx)) * 4
          img.data[i] = img.data[i + 1] = img.data[i + 2] = 20
        }
      }
    }
  }
}

/** Rotate an image clockwise by `turns` quarter turns. */
function rotateImage(img: RgbaImage, turns: number): RgbaImage {
  let cur = img
  for (let k = 0; k < ((turns % 4) + 4) % 4; k++) {
    const out = blank(cur.height, cur.width)
    for (let y = 0; y < cur.height; y++) {
      for (let x = 0; x < cur.width; x++) {
        const src = (y * cur.width + x) * 4
        const nx = cur.height - 1 - y
        const ny = x
        const dst = (ny * out.width + nx) * 4
        out.data[dst] = cur.data[src]
        out.data[dst + 1] = cur.data[src + 1]
        out.data[dst + 2] = cur.data[src + 2]
      }
    }
    cur = out
  }
  return cur
}

/** A full page at `pxPerMm` with its four real markers, then turned. */
function pageImage(page: number, pxPerMm: number, turns: number, opts: { skip?: Corner; padPx?: number } = {}): RgbaImage {
  const pad = opts.padPx ?? 0
  const img = blank(Math.round(layout.pageSize.w * pxPerMm) + 2 * pad, Math.round(layout.pageSize.h * pxPerMm) + 2 * pad)
  const cell = (10 * pxPerMm) / 8
  for (const m of layout.markers) {
    if (m.corner === opts.skip) continue
    paintMarker(img, markerId(page, m.corner), Math.round(pad + m.rect.x * pxPerMm), Math.round(pad + m.rect.y * pxPerMm), Math.round(cell))
  }
  return rotateImage(img, turns)
}

describe('decodeMarker', () => {
  it('reads the id and the orientation of a marker', () => {
    for (const id of [0, 7, 123]) {
      for (let turns = 0; turns < 4; turns++) {
        const base = blank(120, 120)
        paintMarker(base, id, 28, 28, 8)
        const img = rotateImage(base, turns)
        const hit = findMarkerNear(img, { x: 60, y: 60 }, 64, 40)
        expect(hit).not.toBeNull()
        const d = decodeMarker(img, hit as NonNullable<typeof hit>)
        expect(d?.id).toBe(id)
        expect(d?.turns).toBe(turns)
      }
    }
  })
  it('rejects a plain dark square', () => {
    const img = blank(120, 120)
    for (let y = 30; y < 90; y++) for (let x = 30; x < 90; x++) img.data[(y * 120 + x) * 4] = img.data[(y * 120 + x) * 4 + 1] = img.data[(y * 120 + x) * 4 + 2] = 20
    const hit = findMarkerNear(img, { x: 60, y: 60 }, 60, 40)
    expect(hit).not.toBeNull()
    expect(decodeMarker(img, hit as NonNullable<typeof hit>)).toBeNull()
  })
})

describe('detectMarkersBlind', () => {
  it('finds all four markers and the page on an upright scan', () => {
    const r = detectMarkersBlind(pageImage(3, 4, 0, { padPx: 12 }), layout)
    expect(r.found).toEqual([0, 1, 2, 3])
    expect(r.page).toBe(3)
    expect(r.turns).toBe(0)
    expect(r.decoded).toBe(4)
  })
  it('tells how far a turned scan must be rotated back', () => {
    for (let turns = 1; turns < 4; turns++) {
      const r = detectMarkersBlind(pageImage(2, 4, turns), layout)
      expect(r.page).toBe(2)
      expect(r.turns).toBe((4 - turns) % 4)
      expect(r.decoded).toBe(4)
    }
  })
  it('copes with a missing marker', () => {
    const r = detectMarkersBlind(pageImage(5, 4, 2, { skip: 1 }), layout)
    expect(r.page).toBe(5)
    expect(r.turns).toBe(2)
    expect(r.found).toEqual([0, 2, 3])
  })
})
