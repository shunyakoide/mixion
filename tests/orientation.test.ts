import { describe, expect, it } from 'vitest'
import { checkOrientation, orientationMismatch, quarterTurnsToUpright, rotatePoint, rotateQrCorners } from '../src/domain/scan/orientation'

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

describe('checkOrientation', () => {
  const layout = { pageSize: { w: 297, h: 210 }, qrRect: { x: 260, y: 8, w: 20, h: 20 } } // QR printed top-right
  const landscape = { width: 3508, height: 2480 }
  it('is ok when the QR sits in the printed quadrant', () => {
    expect(checkOrientation(landscape, { x: 3100, y: 80, w: 200, h: 200 }, layout)).toEqual({ kind: 'ok' })
  })
  it('asks for a turn when the QR is in another quadrant', () => {
    expect(checkOrientation(landscape, { x: 100, y: 2200, w: 200, h: 200 }, layout)).toEqual({ kind: 'qr_misplaced', expected: 1 })
  })
  it('falls back to the aspect ratio without a QR', () => {
    expect(checkOrientation({ width: 2480, height: 3508 }, null, layout)).toEqual({ kind: 'aspect_mismatch' })
    expect(checkOrientation(landscape, null, layout)).toEqual({ kind: 'ok' })
  })
})

describe('rotatePoint', () => {
  const size = { width: 100, height: 200 }
  it('turns clockwise like rotateBitmap', () => {
    expect(rotatePoint({ x: 0, y: 0 }, 1, size)).toEqual({ x: 200, y: 0 })
    expect(rotatePoint({ x: 10, y: 20 }, 1, size)).toEqual({ x: 180, y: 10 })
    expect(rotatePoint({ x: 10, y: 20 }, 2, size)).toEqual({ x: 90, y: 180 })
    expect(rotatePoint({ x: 10, y: 20 }, 3, size)).toEqual({ x: 20, y: 90 })
  })
  it('is the identity after four turns and for negative turns modulo four', () => {
    expect(rotatePoint({ x: 10, y: 20 }, 4, size)).toEqual({ x: 10, y: 20 })
    expect(rotatePoint({ x: 10, y: 20 }, -1, size)).toEqual(rotatePoint({ x: 10, y: 20 }, 3, size))
  })
  it('keeps a QR upright once its scan is turned back', () => {
    const turned = qrTurned(-90) // page turned counter-clockwise; needs one clockwise turn
    const back = rotateQrCorners(turned, quarterTurnsToUpright(turned), { width: 1000, height: 1000 })
    expect(quarterTurnsToUpright(back)).toBe(0)
  })
})
