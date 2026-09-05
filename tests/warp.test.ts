import { describe, expect, it } from 'vitest'
import { solveHomography, type Homography } from '../src/domain/homography'
import { warpCell, type RgbaImage } from '../src/features/scan/warp'

/** Horizontal gradient in R, vertical in G, constant B. */
function gradientImage(w: number, h: number): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      data[i] = Math.round((255 * x) / (w - 1))
      data[i + 1] = Math.round((255 * y) / (h - 1))
      data[i + 2] = 77
      data[i + 3] = 255
    }
  }
  return { width: w, height: h, data }
}

const px = (img: RgbaImage, x: number, y: number) => {
  const i = (y * img.width + x) * 4
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]]
}

describe('warpCell', () => {
  it('reproduces the source under an identity mapping (1 px = 1 mm)', () => {
    const src = gradientImage(64, 32)
    const identity: Homography = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    const out = warpCell(src, identity, { cropRect: { x: 0, y: 0, w: 64, h: 32 }, outWidth: 64, outHeight: 32 })
    expect(out.width).toBe(64)
    expect(out.height).toBe(32)
    for (const [x, y] of [[0, 0], [63, 31], [10, 20], [40, 5]]) {
      expect(px(out, x, y)).toEqual(px(src, x, y))
    }
  })

  it('cuts out a sub-rectangle at a different resolution', () => {
    const src = gradientImage(200, 100)
    // Page is 200x100 mm and the scan is 1 px per mm.
    const identity: Homography = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    const out = warpCell(src, identity, { cropRect: { x: 50, y: 25, w: 100, h: 50 }, outWidth: 50, outHeight: 25 })
    // Output centre should sample the source at (100, 50).
    const c = px(out, 25, 12)
    expect(Math.abs(c[0] - 255 * (100 / 199))).toBeLessThan(3)
    expect(Math.abs(c[1] - 255 * (50 / 99))).toBeLessThan(3)
    expect(c[2]).toBe(77)
  })

  it('follows a scaled + translated homography', () => {
    const src = gradientImage(120, 60)
    // 2 px per mm, scan offset by (10, 4) px.
    const h = solveHomography(
      [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 25 }, { x: 0, y: 25 }],
      [{ x: 10, y: 4 }, { x: 110, y: 4 }, { x: 110, y: 54 }, { x: 10, y: 54 }],
    )
    const out = warpCell(src, h, { cropRect: { x: 0, y: 0, w: 50, h: 25 }, outWidth: 100, outHeight: 50 })
    // Output pixel (40, 20) centre → mm (20.25, 10.25) → scan px (50.5, 24.5) → sample index (50, 24).
    expect(px(out, 40, 20)).toEqual(px(src, 50, 24))
  })

  it('fills pixels outside the scan with white', () => {
    const src = gradientImage(20, 20)
    const identity: Homography = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    const out = warpCell(src, identity, { cropRect: { x: 100, y: 100, w: 10, h: 10 }, outWidth: 10, outHeight: 10 })
    expect(px(out, 5, 5)).toEqual([255, 255, 255, 255])
  })
})
