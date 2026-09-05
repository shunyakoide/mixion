import { describe, expect, it } from 'vitest'
import {
  MARKER_CODES,
  MARKER_COUNT,
  MARKER_MODULES,
  MAX_MARKER_PAGES,
  decodeMarkerId,
  markerId,
  markerModules,
} from '../src/domain/markers'

describe('marker dictionary', () => {
  it('has 250 unique 36-bit codes', () => {
    expect(MARKER_COUNT).toBe(250)
    expect(new Set(MARKER_CODES).size).toBe(250)
    for (const c of MARKER_CODES) {
      expect(Number.isInteger(c)).toBe(true)
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThan(2 ** 36)
    }
  })
  it('labels up to 62 pages', () => {
    expect(MAX_MARKER_PAGES).toBe(62)
  })
})

describe('markerId', () => {
  it('encodes page and corner and decodes them back', () => {
    expect(markerId(1, 0)).toBe(0)
    expect(markerId(1, 3)).toBe(3)
    expect(markerId(3, 2)).toBe(10)
    expect(decodeMarkerId(10)).toEqual({ page: 3, corner: 2 })
    for (let page = 1; page <= MAX_MARKER_PAGES; page++) {
      for (const corner of [0, 1, 2, 3] as const) {
        expect(decodeMarkerId(markerId(page, corner))).toEqual({ page, corner })
      }
    }
  })
  it('rejects pages beyond the dictionary', () => {
    expect(() => markerId(63, 0)).toThrow()
    expect(() => markerId(0, 0)).toThrow()
    expect(() => decodeMarkerId(250)).toThrow()
  })
})

describe('markerModules', () => {
  it('is an 8x8 grid with a black border', () => {
    const g = markerModules(0)
    expect(g).toHaveLength(MARKER_MODULES)
    for (const row of g) expect(row).toHaveLength(MARKER_MODULES)
    for (let i = 0; i < MARKER_MODULES; i++) {
      expect(g[0][i]).toBe(true)
      expect(g[7][i]).toBe(true)
      expect(g[i][0]).toBe(true)
      expect(g[i][7]).toBe(true)
    }
  })
  it('reads the code MSB first, row-major, 1 = white (js-aruco2 convention)', () => {
    // code 0 = 0xd2b63a09d = 1101 0010 1011 0110 0011 1010 0000 1001 1101
    const bits = MARKER_CODES[0].toString(2).padStart(36, '0')
    const g = markerModules(0)
    for (let i = 0; i < 36; i++) {
      const r = 1 + Math.floor(i / 6)
      const c = 1 + (i % 6)
      expect(g[r][c]).toBe(bits[i] === '0')
    }
  })
  it('produces a different grid for every id', () => {
    const seen = new Set<string>()
    for (let id = 0; id < MARKER_COUNT; id++) {
      seen.add(markerModules(id).map((r) => r.map((b) => (b ? '1' : '0')).join('')).join('/'))
    }
    expect(seen.size).toBe(MARKER_COUNT)
  })
})
