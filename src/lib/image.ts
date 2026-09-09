import type { RgbaImage } from '../features/scan/warp'
import { t } from '../i18n'

export async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    throw new Error(t().errors.cannotLoadImage((file as File).name ?? ''))
  }
}

/** Draw a bitmap (or canvas) into RGBA pixels, optionally downscaled to `maxWidth`. */
export function bitmapToRgba(bitmap: ImageBitmap | OffscreenCanvas, maxWidth?: number): RgbaImage {
  const scale = maxWidth && bitmap.width > maxWidth ? maxWidth / bitmap.width : 1
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas context unavailable')
  ctx.drawImage(bitmap, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  return { width: w, height: h, data: img.data }
}


export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|tiff?|bmp)$/i.test(file.name)
}

/** Natural sort so scan_2 comes before scan_10. */
export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/** Rotate a bitmap by `quarterTurns` × 90° clockwise into a JPEG blob. */
export async function rotateBitmap(bitmap: ImageBitmap, quarterTurns: number, quality = 0.95): Promise<{ blob: Blob; width: number; height: number }> {
  const k = ((quarterTurns % 4) + 4) % 4
  const swap = k % 2 === 1
  const width = swap ? bitmap.height : bitmap.width
  const height = swap ? bitmap.width : bitmap.height
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas context unavailable')
  ctx.translate(width / 2, height / 2)
  ctx.rotate((k * Math.PI) / 2)
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  return { blob: await canvas.convertToBlob({ type: 'image/jpeg', quality }), width, height }
}

/** Put RGBA pixels on an OffscreenCanvas so they can be drawn (and scaled) again. */
export function rgbaToCanvas(img: RgbaImage): OffscreenCanvas {
  const canvas = new OffscreenCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas context unavailable')
  ctx.putImageData(new ImageData(img.data, img.width, img.height), 0, 0)
  return canvas
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
