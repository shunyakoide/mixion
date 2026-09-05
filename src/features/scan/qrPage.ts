import jsQR from 'jsqr'
import { decodeQrPayload, type QrPayload } from '../../domain/settings'
import { bitmapToRgba } from '../../lib/image'
import type { QrCornersPx } from './detectMarkers'

export type QrReadResult =
  | { ok: true; payload: QrPayload; text: string; corners: QrCornersPx }
  | { ok: false; error: string; text: string | null }

/**
 * Find and decode the Mixion QR on a scanned page. Tries a downscaled copy
 * first (fast), then full resolution. Corner positions are returned in the
 * bitmap's own pixel coordinates.
 */
export function readPageQr(bitmap: ImageBitmap): QrReadResult {
  const attempts = [1600, 2600, undefined]
  let lastText: string | null = null
  for (const maxWidth of attempts) {
    if (maxWidth && bitmap.width <= maxWidth && maxWidth !== attempts[0]) continue
    const img = bitmapToRgba(bitmap, maxWidth)
    const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
    if (!res) continue
    lastText = res.data
    const decoded = decodeQrPayload(res.data)
    if (!decoded.ok) return { ok: false, error: `QR は読めましたが Mixion の形式ではありません (${decoded.error})`, text: res.data }
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
  return { ok: false, error: 'QR コードが見つかりません', text: lastText }
}
