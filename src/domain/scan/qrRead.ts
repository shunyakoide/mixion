/**
 * Finding and decoding the Mixion QR on a scanned page, on plain RGBA pixels.
 * The browser hands in a decoded bitmap and a canvas-based resampler; tests
 * paint a page and use the pure one. Either way this is the code that decides
 * which passes to try, so a change to the passes is tested here.
 */
import jsQR from 'jsqr'
import { decodeQrPayload, type QrPayload } from '../settings'
import type { QrCornersPx } from './detectMarkers'
import { downscaleRgba, thinBlack, type RgbaImage } from './rgba'

/** Why no Mixion QR came out of a read. */
export type QrReadFailure =
  | { kind: 'noQr' }
  /** A QR code decoded, but its text is not a Mixion page; `detail` says what was wrong with it. */
  | { kind: 'notMixion'; detail: string }

export type QrRead =
  | { ok: true; payload: QrPayload; text: string; corners: QrCornersPx }
  | { ok: false; failure: QrReadFailure; text: string | null; /** Passes already searched (see `passKey`), so a later call can skip them. */ tried: string[] }

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
export const QR_ALL_PASSES: QrPass[] = [...QR_QUICK_PASSES, ...QR_THOROUGH_PASSES]

export function passKey(width: number, thin: boolean): string {
  return thin ? `${width}t` : `${width}`
}

/** Shrink `img` to `width` px across. */
export type Resample = (img: RgbaImage, width: number) => RgbaImage

/**
 * Try each pass in `passes` on `image`, skipping any already in `tried`.
 * Thinning happens at full resolution before any downscale: thinning an
 * already downscaled copy takes away too much. Corner positions come back in
 * `image`'s own pixel coordinates.
 */
export function readQrFromRgba(image: RgbaImage, passes: QrPass[] = QR_ALL_PASSES, tried: string[] = [], resample: Resample = downscaleRgba): QrRead {
  const done = new Set(tried)
  let lastText: string | null = null
  let thinned: RgbaImage | null = null
  for (const pass of passes) {
    const effective = pass.width === undefined ? image.width : Math.min(pass.width, image.width)
    const key = passKey(effective, pass.thin === true)
    if (done.has(key)) continue
    done.add(key)
    if (pass.thin && !thinned) thinned = thinBlack(image)
    const base = pass.thin && thinned ? thinned : image
    const img = effective < base.width ? resample(base, effective) : base
    const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
    if (!res) continue
    lastText = res.data
    const decoded = decodeQrPayload(res.data)
    if (!decoded.ok) return { ok: false, failure: { kind: 'notMixion', detail: decoded.error }, text: res.data, tried: [...done] }
    const k = image.width / img.width
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
  return { ok: false, failure: { kind: 'noQr' }, text: lastText, tried: [...done] }
}
