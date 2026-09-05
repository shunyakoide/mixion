import jsQR from 'jsqr'
import { decodeQrPayload, type QrPayload } from '../../domain/settings'
import { bitmapToRgba } from '../../lib/image'

export type QrReadResult = { ok: true; payload: QrPayload; text: string } | { ok: false; error: string; text: string | null }

/**
 * Find and decode the Mixion QR on a scanned page. Tries a downscaled copy
 * first (fast), then full resolution.
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
    if (decoded.ok) return { ok: true, payload: decoded.payload, text: res.data }
    return { ok: false, error: `QR は読めましたが Mixion の形式ではありません (${decoded.error})`, text: res.data }
  }
  return { ok: false, error: 'QR コードが見つかりません', text: lastText }
}
