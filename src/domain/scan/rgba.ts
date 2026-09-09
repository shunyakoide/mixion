/**
 * The pixel type the scan pipeline works on: ImageData-shaped RGBA, so the
 * same code runs in the browser, in a Worker and in Node tests, and the two
 * pure filters the QR reader needs on it.
 */

export interface RgbaImage {
  width: number
  height: number
  data: Uint8ClampedArray<ArrayBuffer>
}

/**
 * Grayscale copy with every dark feature thinned by one pixel on each side
 * (a 3×3 maximum filter). Ink spreads when a page is printed, so black QR
 * modules come back from the scanner bolder than the white ones; this undoes
 * roughly that much and makes the finder patterns readable again.
 */
export function thinBlack(img: RgbaImage): RgbaImage {
  const { width: w, height: h, data: d } = img
  const gray = new Uint8Array(w * h)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = (d[p] * 299 + d[p + 1] * 587 + d[p + 2] * 114) / 1000
  // Separable max: rows first, then columns.
  const rows = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const o = y * w
    for (let x = 0; x < w; x++) {
      let m = gray[o + x]
      if (x > 0 && gray[o + x - 1] > m) m = gray[o + x - 1]
      if (x + 1 < w && gray[o + x + 1] > m) m = gray[o + x + 1]
      rows[o + x] = m
    }
  }
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const o = y * w
    for (let x = 0; x < w; x++) {
      let m = rows[o + x]
      if (y > 0 && rows[o - w + x] > m) m = rows[o - w + x]
      if (y + 1 < h && rows[o + w + x] > m) m = rows[o + w + x]
      const p = (o + x) * 4
      out[p] = m
      out[p + 1] = m
      out[p + 2] = m
      out[p + 3] = 255
    }
  }
  return { width: w, height: h, data: out }
}

/**
 * Shrink an image to `width` px across by averaging the source pixels each
 * output pixel covers (a box filter). Returns the input unchanged when it is
 * already that narrow. The browser draws on a canvas for this instead; this
 * one is for code that has no canvas.
 */
export function downscaleRgba(img: RgbaImage, width: number): RgbaImage {
  if (width >= img.width) return img
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round((img.height * w) / img.width))
  const out = new Uint8ClampedArray(w * h * 4)
  const sd = img.data
  const sw = img.width
  for (let oy = 0; oy < h; oy++) {
    const y0 = Math.floor((oy * img.height) / h)
    const y1 = Math.max(y0 + 1, Math.floor(((oy + 1) * img.height) / h))
    for (let ox = 0; ox < w; ox++) {
      const x0 = Math.floor((ox * sw) / w)
      const x1 = Math.max(x0 + 1, Math.floor(((ox + 1) * sw) / w))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let y = y0; y < y1; y++) {
        let i = (y * sw + x0) * 4
        for (let x = x0; x < x1; x++, i += 4) {
          r += sd[i]
          g += sd[i + 1]
          b += sd[i + 2]
          n++
        }
      }
      const o = (oy * w + ox) * 4
      out[o] = r / n
      out[o + 1] = g / n
      out[o + 2] = b / n
      out[o + 3] = 255
    }
  }
  return { width: w, height: h, data: out }
}
