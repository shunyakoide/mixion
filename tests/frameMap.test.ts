import { describe, expect, it } from 'vitest'
import {
  cellOf,
  frameAt,
  frameCount,
  frameLabel,
  frameRangeOnPage,
  frameTimestamp,
  framesOnPage,
  framesPerPage,
  pageCount,
  pageOf,
} from '../src/domain/frameMap'

describe('frameCount', () => {
  it('gives 40 frames for the 5s @ 8fps goal', () => {
    expect(frameCount(5, 8)).toBe(40)
  })
  it('tolerates container durations a few ms off', () => {
    expect(frameCount(5.005, 8)).toBe(40)
    expect(frameCount(4.98, 8)).toBe(40)
    expect(frameCount(5.06, 8)).toBe(40)
    expect(frameCount(5.07, 8)).toBe(41)
  })
  it('never returns 0 for a positive duration', () => {
    expect(frameCount(0.01, 6)).toBe(1)
  })
  it('returns 0 for unusable input', () => {
    expect(frameCount(0, 8)).toBe(0)
    expect(frameCount(Number.NaN, 8)).toBe(0)
    expect(frameCount(5, 0)).toBe(0)
  })
  it('keeps every sample time strictly inside the video', () => {
    for (const fps of [6, 8, 12, 24]) {
      for (let d = 0.05; d < 12; d += 0.037) {
        const n = frameCount(d, fps)
        expect(frameTimestamp(n, fps)).toBeLessThan(d)
      }
    }
  })
})

describe('page / cell mapping', () => {
  const perPage = framesPerPage({ cols: 2, rows: 2 })

  it('has 4 frames per page for 2x2', () => {
    expect(perPage).toBe(4)
  })
  it('gives 10 pages for 40 frames', () => {
    expect(pageCount(40, perPage)).toBe(10)
    expect(pageCount(41, perPage)).toBe(11)
    expect(pageCount(0, perPage)).toBe(0)
  })
  it('maps frame 9 to page 3, cell 0', () => {
    expect(pageOf(9, perPage)).toBe(3)
    expect(cellOf(9, perPage)).toBe(0)
    expect(frameAt(3, 0, perPage)).toBe(9)
  })
  it('maps frame 12 to page 3, cell 3', () => {
    expect(pageOf(12, perPage)).toBe(3)
    expect(cellOf(12, perPage)).toBe(3)
  })
  it('round-trips every frame', () => {
    for (const grid of [{ cols: 2, rows: 2 }, { cols: 3, rows: 3 }, { cols: 4, rows: 3 }]) {
      const pp = framesPerPage(grid)
      for (let f = 1; f <= 100; f++) {
        expect(frameAt(pageOf(f, pp), cellOf(f, pp), pp)).toBe(f)
      }
    }
  })
  it('lists frames on a page and clips the last page', () => {
    expect(framesOnPage(1, perPage, 40)).toEqual([1, 2, 3, 4])
    expect(framesOnPage(10, perPage, 40)).toEqual([37, 38, 39, 40])
    expect(framesOnPage(10, perPage, 38)).toEqual([37, 38])
    expect(framesOnPage(11, perPage, 40)).toEqual([])
    expect(frameRangeOnPage(3, perPage, 40)).toEqual([9, 12])
    expect(frameRangeOnPage(11, perPage, 40)).toBeNull()
  })
})

describe('labels and timestamps', () => {
  it('pads frame labels to the total width', () => {
    expect(frameLabel(9, 40)).toBe('#09')
    expect(frameLabel(9, 120)).toBe('#009')
    expect(frameLabel(3, 5)).toBe('#03')
  })
  it('samples frame 1 at t=0', () => {
    expect(frameTimestamp(1, 8)).toBe(0)
    expect(frameTimestamp(9, 8)).toBe(1)
  })
})
