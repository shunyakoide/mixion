import jsQR from 'jsqr'
import { t } from '../../i18n'
import { decodeQrPayload, type QrPayload } from '../../domain/settings'
import { bitmapToRgba } from '../../lib/image'
import type { QrCornersPx } from './detectMarkers'

export type QrReadResult =
  | { ok: true; payload: QrPayload; text: string; corners: QrCornersPx }
  | { ok: false; error: string; text: string | null; /** Image widths (px) already searched, so a later pass can skip them. */ tried: number[] }

/** Downscaled pass: 1600 px across gives a 16 mm code on A4 about 4 px per module, enough for a clean print. */
export const QR_QUICK_WIDTHS: (number | undefined)[] = [1600]
/** Slow passes for a small or blurry code; `undefined` is full resolution. */
export const QR_THOROUGH_WIDTHS: (number | undefined)[] = [2600, undefined]

/**
 * Find and decode the Mixion QR on a scanned page, trying each width in
 * `widths` (undefined = full resolution) and skipping any already in `tried`.
 * Corner positions are returned in the bitmap's own pixel coordinates.
 */
export function readPageQr(bitmap: ImageBitmap, widths: (number | undefined)[] = [...QR_QUICK_WIDTHS, ...QR_THOROUGH_WIDTHS], tried: number[] = []): QrReadResult {
  const done = new Set(tried)
  let lastText: string | null = null
  for (const maxWidth of widths) {
    const effective = maxWidth === undefined ? bitmap.width : Math.min(maxWidth, bitmap.width)
    if (done.has(effective)) continue
    done.add(effective)
    const img = bitmapToRgba(bitmap, maxWidth)
    const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
    if (!res) continue
    lastText = res.data
    const decoded = decodeQrPayload(res.data)
    if (!decoded.ok) return { ok: false, error: t().scan.errNotMixionQr(decoded.error), text: res.data, tried: [...done] }
    const k = bitmap.width / img.width
    const scale = (p: { x: number; y: number }) => ({ x: p.x * k, y: p.y * k })
    return {
      ok: true,
      payload: decoded.payload,
      text: res.data,
      corners: {
        topLeft: scale(res.location.topLeftCorner),
        topRight: scale(res.location.topRightCorner),
        bottomRight: scale(res.location.bottomRightCorner),
        bottomLeft: scale(res.location.bottomLeftCorner),
      },
    }
  }
  return { ok: false, error: t().scan.errNoQr, text: lastText, tried: [...done] }
}
