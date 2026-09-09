import type { RgbaImage } from '../domain/scan/rgba'
import { MediaError } from './errors'

export async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    throw new MediaError({ code: 'cannotLoadImage', name: (file as File).name ?? '' })
  }
}

/**
 * Decode an image straight to `width`×`height` (or to `width` keeping the
 * aspect), so the bitmap costs only what is shown. Browsers without resize
 * options decode at full size and scale on a canvas.
 */
export async function decodeScaled(blob: Blob, width: number, height?: number): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' })
  } catch {
    const full = await createImageBitmap(blob)
    const h = height ?? Math.max(1, Math.round((full.height * width) / full.width))
    const canvas = new OffscreenCanvas(width, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas context unavailable')
    ctx.drawImage(full, 0, 0, width, h)
    full.close()
    return createImageBitmap(canvas)
  }
}

/** A small JPEG of an image, `width` px wide, for lists of many frames. */
export async function thumbnailBlob(blob: Blob, width: number, quality = 0.8): Promise<Blob> {
  const bitmap = await decodeScaled(blob, width)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas context unavailable')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas.convertToBlob({ type: 'image/jpeg', quality })
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

