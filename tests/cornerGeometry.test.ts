import { describe, expect, it } from 'vitest'
import { cornerFromPosition, cornersConsistent } from '../src/domain/scan/cornerGeometry'

const W = 2480
const H = 3508

describe('cornerFromPosition', () => {
  it('maps each quadrant to its corner, whatever the click order', () => {
    expect(cornerFromPosition({ x: 100, y: 100 }, W, H)).toBe(0)
    expect(cornerFromPosition({ x: W - 100, y: 100 }, W, H)).toBe(1)
    expect(cornerFromPosition({ x: W - 100, y: H - 100 }, W, H)).toBe(2)
    expect(cornerFromPosition({ x: 100, y: H - 100 }, W, H)).toBe(3)
  })
  it('splits exactly at the centre lines', () => {
    expect(cornerFromPosition({ x: W / 2 - 1, y: H / 2 - 1 }, W, H)).toBe(0)
    expect(cornerFromPosition({ x: W / 2, y: H / 2 }, W, H)).toBe(2)
  })
})

describe('cornersConsistent', () => {
  const good = { 0: { x: 100, y: 100 }, 1: { x: 2300, y: 120 }, 2: { x: 2280, y: 3400 }, 3: { x: 90, y: 3380 } }
  it('accepts a clockwise convex quad', () => {
    expect(cornersConsistent(good)).toBe(true)
  })
  it('accepts a rotated or skewed page', () => {
    expect(cornersConsistent({ 0: { x: 300, y: 50 }, 1: { x: 2400, y: 400 }, 2: { x: 2100, y: 3450 }, 3: { x: 50, y: 3100 } })).toBe(true)
  })
  it('rejects two corners swapped (the wrong click order)', () => {
    expect(cornersConsistent({ ...good, 1: good[2], 2: good[1] })).toBe(false)
    expect(cornersConsistent({ ...good, 0: good[3], 3: good[0] })).toBe(false)
  })
  it('rejects a self-intersecting quad', () => {
    expect(cornersConsistent({ ...good, 2: good[3], 3: good[2] })).toBe(false)
  })
  it('does not complain while corners are still missing', () => {
    expect(cornersConsistent({ 0: good[0], 1: good[2] })).toBe(true)
    expect(cornersConsistent({})).toBe(true)
  })
})
