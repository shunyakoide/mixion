import { t } from '../../i18n'
import { readQrFromRgba, type QrPass, type QrRead, type QrReadFailure } from '../../domain/scan/qrRead'
import type { RgbaImage } from '../../domain/scan/rgba'
import { bitmapToRgba, rgbaToCanvas } from '../../lib/image'

export { QR_ALL_PASSES, QR_QUICK_PASSES, QR_THOROUGH_PASSES, type QrPass } from '../../domain/scan/qrRead'

export type QrReadResult =
  | Extract<QrRead, { ok: true }>
  | { ok: false; error: string; text: string | null; /** Passes already searched (see `passKey`), so a later call can skip them. */ tried: string[] }

/**
 * Downscale on a canvas, as the browser does it best. The page itself is
 * drawn straight from its bitmap; a thinned copy goes onto a canvas once
 * and that canvas serves every pass on it.
 */
function canvasResampler(bitmap: ImageBitmap, page: RgbaImage): (img: RgbaImage, width: number) => RgbaImage {
  const canvases = new WeakMap<RgbaImage, OffscreenCanvas>()
  return (img, width) => {
    if (img === page) return bitmapToRgba(bitmap, width)
    let canvas = canvases.get(img)
    if (!canvas) {
      canvas = rgbaToCanvas(img)
      canvases.set(img, canvas)
    }
    return bitmapToRgba(canvas, width)
  }
}

function describeFailure(failure: QrReadFailure): string {
  return failure.kind === 'noQr' ? t().scan.errNoQr : t().scan.errNotMixionQr(failure.detail)
}

/**
 * Find and decode the Mixion QR on a scanned page, trying each pass in
 * `passes` and skipping any already in `tried`.
 * Corner positions are returned in the bitmap's own pixel coordinates.
 */
export function readPageQr(bitmap: ImageBitmap, passes?: QrPass[], tried: string[] = []): QrReadResult {
  const page = bitmapToRgba(bitmap)
  const r = readQrFromRgba(page, passes, tried, canvasResampler(bitmap, page))
  if (r.ok) return r
  return { ok: false, error: describeFailure(r.failure), text: r.text, tried: r.tried }
}
