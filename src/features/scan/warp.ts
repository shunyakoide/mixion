/**
 * Inverse-mapping perspective warp with bilinear sampling. Given a homography
 * from page mm to scan pixels, produce the output image of one crop
 * rectangle. Pure function on typed arrays so it runs in a Worker and in
 * tests; no DOM types beyond the ImageData-shaped input.
 */
import { applyHomography, type Homography } from '../../domain/homography'
import type { Rect } from '../../domain/layout'

export interface RgbaImage {
  width: number
  height: number
  data: Uint8ClampedArray<ArrayBuffer>
}

export interface WarpJob {
  /** Page-mm rectangle to cut out. */
  cropRect: Rect
  outWidth: number
  outHeight: number
}

/**
 * Sample `src` at every pixel of the output. Pixel centres are mapped
 * (ox + 0.5, oy + 0.5) → mm → scan px, then bilinearly interpolated.
 * Pixels that fall outside the scan are white.
 */
export function warpCell(src: RgbaImage, h: Homography, job: WarpJob): RgbaImage {
  const { cropRect, outWidth, outHeight } = job
  const out = new Uint8ClampedArray(outWidth * outHeight * 4)
  const sw = src.width
  const sh = src.height
  const sd = src.data
  const mmPerPxX = cropRect.w / outWidth
  const mmPerPxY = cropRect.h / outHeight

  for (let oy = 0; oy < outHeight; oy++) {
    const my = cropRect.y + (oy + 0.5) * mmPerPxY
    let o = oy * outWidth * 4
    for (let ox = 0; ox < outWidth; ox++, o += 4) {
      const mx = cropRect.x + (ox + 0.5) * mmPerPxX
      const p = applyHomography(h, { x: mx, y: my })
      // Convert from pixel-centre convention to array index space.
      const fx = p.x - 0.5
      const fy = p.y - 0.5
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) {
        // Edge/outside: clamp when just outside by <1px, otherwise white.
        const cx = Math.min(sw - 1, Math.max(0, Math.round(fx)))
        const cy = Math.min(sh - 1, Math.max(0, Math.round(fy)))
        if (fx < -1 || fy < -1 || fx > sw || fy > sh) {
          out[o] = 255
          out[o + 1] = 255
          out[o + 2] = 255
          out[o + 3] = 255
        } else {
          const i = (cy * sw + cx) * 4
          out[o] = sd[i]
          out[o + 1] = sd[i + 1]
          out[o + 2] = sd[i + 2]
          out[o + 3] = 255
        }
        continue
      }
      const tx = fx - x0
      const ty = fy - y0
      const i00 = (y0 * sw + x0) * 4
      const i10 = i00 + 4
      const i01 = i00 + sw * 4
      const i11 = i01 + 4
      const w00 = (1 - tx) * (1 - ty)
      const w10 = tx * (1 - ty)
      const w01 = (1 - tx) * ty
      const w11 = tx * ty
      out[o] = sd[i00] * w00 + sd[i10] * w10 + sd[i01] * w01 + sd[i11] * w11
      out[o + 1] = sd[i00 + 1] * w00 + sd[i10 + 1] * w10 + sd[i01 + 1] * w01 + sd[i11 + 1] * w11
      out[o + 2] = sd[i00 + 2] * w00 + sd[i10 + 2] * w10 + sd[i01 + 2] * w01 + sd[i11 + 2] * w11
      out[o + 3] = 255
    }
  }
  return { width: outWidth, height: outHeight, data: out }
}

/** Axis-aligned window of `src` that covers `cropRect` under `h`, padded by `pad` px and clamped to the image. */
export function sourceWindow(src: { width: number; height: number }, h: Homography, cropRect: Rect, pad = 2): Rect {
  const corners = [
    { x: cropRect.x, y: cropRect.y },
    { x: cropRect.x + cropRect.w, y: cropRect.y },
    { x: cropRect.x + cropRect.w, y: cropRect.y + cropRect.h },
    { x: cropRect.x, y: cropRect.y + cropRect.h },
  ].map((p) => applyHomography(h, p))
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p.x)) - pad))
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p.y)) - pad))
  const x1 = Math.min(src.width, Math.ceil(Math.max(...corners.map((p) => p.x)) + pad))
  const y1 = Math.min(src.height, Math.ceil(Math.max(...corners.map((p) => p.y)) + pad))
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

/** Copy a window out of an image. */
export function cropRgba(src: RgbaImage, r: Rect): RgbaImage {
  const data = new Uint8ClampedArray(r.w * r.h * 4)
  for (let y = 0; y < r.h; y++) data.set(src.data.subarray(((r.y + y) * src.width + r.x) * 4, ((r.y + y) * src.width + r.x + r.w) * 4), y * r.w * 4)
  return { width: r.w, height: r.h, data }
}

/** The same mapping expressed in a coordinate system whose origin sits at (dx, dy) of the old one. */
export function translateHomography(h: Homography, dx: number, dy: number): Homography {
  return [h[0] - dx * h[6], h[1] - dx * h[7], h[2] - dx * h[8], h[3] - dy * h[6], h[4] - dy * h[7], h[5] - dy * h[8], h[6], h[7], h[8]]
}
