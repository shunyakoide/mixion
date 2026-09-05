import type { RgbaImage } from '../features/scan/warp'

export async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    throw new Error(`画像を読み込めません: ${(file as File).name ?? ''}`)
  }
}

/** Draw a bitmap into RGBA pixels, optionally downscaled to `maxWidth`. */
export function bitmapToRgba(bitmap: ImageBitmap, maxWidth?: number): RgbaImage {
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

export async function rgbaToBlob(img: RgbaImage, type = 'image/jpeg', quality = 0.92): Promise<Blob> {
  const canvas = new OffscreenCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas context unavailable')
  ctx.putImageData(new ImageData(img.data, img.width, img.height), 0, 0)
  return canvas.convertToBlob({ type, quality })
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|tiff?|bmp)$/i.test(file.name)
}

/** Natural sort so scan_2 comes before scan_10. */
export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}
