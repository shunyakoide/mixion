import { describe, expect, it } from 'vitest'
import { orientationMismatch, quarterTurnsToUpright } from '../src/features/scan/orientation'

/** A 100 px QR whose page has been turned `deg` clockwise on the scan. */
function qrTurned(deg: number) {
  const a = (deg * Math.PI) / 180
  const rot = (x: number, y: number) => ({ x: 500 + x * Math.cos(a) - y * Math.sin(a), y: 500 + x * Math.sin(a) + y * Math.cos(a) })
  return { topLeft: rot(-50, -50), topRight: rot(50, -50), bottomRight: rot(50, 50), bottomLeft: rot(-50, 50) }
}

describe('quarterTurnsToUpright', () => {
  it('is 0 for an upright page, even when slightly skewed', () => {
    expect(quarterTurnsToUpright(qrTurned(0))).toBe(0)
    expect(quarterTurnsToUpright(qrTurned(12))).toBe(0)
    expect(quarterTurnsToUpright(qrTurned(-20))).toBe(0)
  })
  it('undoes a page turned clockwise with a counter-clockwise turn', () => {
    expect(quarterTurnsToUpright(qrTurned(90))).toBe(3)
    expect(quarterTurnsToUpright(qrTurned(-90))).toBe(1)
    expect(quarterTurnsToUpright(qrTurned(180))).toBe(2)
    expect(quarterTurnsToUpright(qrTurned(95))).toBe(3)
  })
})

describe('orientationMismatch', () => {
  it('flags a portrait scan of a landscape page', () => {
    expect(orientationMismatch({ width: 2480, height: 3508 }, { w: 297, h: 210 })).toBe(true)
    expect(orientationMismatch({ width: 3508, height: 2480 }, { w: 297, h: 210 })).toBe(false)
  })
})
