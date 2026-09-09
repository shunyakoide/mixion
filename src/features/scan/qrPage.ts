import jsQR from 'jsqr'
import { t } from '../../i18n'
import { decodeQrPayload, type QrPayload } from '../../domain/settings'
import { bitmapToRgba, rgbaToCanvas, thinBlack } from '../../lib/image'
import type { QrCornersPx } from './detectMarkers'

export type QrReadResult =
  | { ok: true; payload: QrPayload; text: string; corners: QrCornersPx }
  | { ok: false; error: string; text: string | null; /** Passes already searched (see `passKey`), so a later call can skip them. */ tried: string[] }

/** One attempt at finding the QR: an image width to search at (undefined = full resolution), optionally after thinning the ink. */
export interface QrPass {
  width?: number
  /** Thin every dark feature by a pixel first (see `thinBlack`); this is what makes an inkjet print readable. */
  thin?: boolean
}

/**
 * Downscaled passes: 1600 px across gives a 16 mm code on A4 about 6 px per module.
 * The plain pass suits a laser print or a digital page; the thinned one an inkjet print, where ink spread makes the black modules bolder.
 */
export const QR_QUICK_PASSES: QrPass[] = [{ width: 1600 }, { width: 1600, thin: true }]
/** Slow passes for a small or blurry code. Thinned first: on a real scan it is the more likely to succeed. */
export const QR_THOROUGH_PASSES: QrPass[] = [{ width: 2600, thin: true }, { thin: true }, { width: 2600 }, {}]

function passKey(width: number, thin: boolean): string {
  return thin ? `${width}t` : `${width}`
}

/**
 * Find and decode the Mixion QR on a scanned page, trying each pass in
 * `passes` and skipping any already in `tried`.
 * Corner positions are returned in the bitmap's own pixel coordinates.
 */
export function readPageQr(bitmap: ImageBitmap, passes: QrPass[] = [...QR_QUICK_PASSES, ...QR_THOROUGH_PASSES], tried: string[] = []): QrReadResult {
  const done = new Set(tried)
  let lastText: string | null = null
  let thinned: OffscreenCanvas | null = null
  for (const pass of passes) {
    const effective = pass.width === undefined ? bitmap.width : Math.min(pass.width, bitmap.width)
    const key = passKey(effective, pass.thin === true)
    if (done.has(key)) continue
    done.add(key)
    // Thin at full resolution, then downscale: thinning an already downscaled copy takes away too much.
    if (pass.thin && !thinned) thinned = rgbaToCanvas(thinBlack(bitmapToRgba(bitmap)))
    const img = bitmapToRgba(pass.thin && thinned ? thinned : bitmap, pass.width)
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
