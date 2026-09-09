import type { QrCornersPx } from './detectMarkers'
import type { Corner, Point, Rect, Size } from '../layout'
import { cornerFromPosition } from './cornerGeometry'

/** Quarter turns, clockwise, 0..3. */
export type QuarterTurns = 0 | 1 | 2 | 3

/**
 * How many clockwise quarter turns bring the scanned page upright, judged from
 * the QR code's own top edge. A page scanned sideways or upside down is common:
 * flatbeds take A4 portrait, the print pages are usually landscape.
 */
export function quarterTurnsToUpright(qr: QrCornersPx): QuarterTurns {
  const top = { x: qr.topRight.x - qr.topLeft.x, y: qr.topRight.y - qr.topLeft.y }
  const deg = (Math.atan2(top.y, top.x) * 180) / Math.PI
  // deg is how far the page is turned clockwise in the image (y grows downwards); undo it.
  const k = ((Math.round(deg / 90) % 4) + 4) % 4
  return ((4 - k) % 4) as QuarterTurns
}

/** True when the image is portrait but the page is landscape, or the other way round. */
export function orientationMismatch(image: { width: number; height: number }, page: { w: number; h: number }): boolean {
  return image.width > image.height !== page.w > page.h
}

export type OrientationCheck = { kind: 'ok' } | { kind: 'qr_misplaced'; expected: Corner } | { kind: 'aspect_mismatch' }

/**
 * Whether the scan still looks turned the wrong way, so the user should rotate
 * it before picking corners by hand. When the QR was read, its quadrant in the
 * image must match the quadrant it is printed in; otherwise fall back to the
 * page's aspect ratio.
 */
export function checkOrientation(image: { width: number; height: number }, qrRect: Rect | null, layout: { pageSize: Size; qrRect: Rect }): OrientationCheck {
  const expected = cornerFromPosition({ x: layout.qrRect.x + layout.qrRect.w / 2, y: layout.qrRect.y + layout.qrRect.h / 2 }, layout.pageSize.w, layout.pageSize.h)
  if (qrRect) {
    const actual = cornerFromPosition({ x: qrRect.x + qrRect.w / 2, y: qrRect.y + qrRect.h / 2 }, image.width, image.height)
    return actual === expected ? { kind: 'ok' } : { kind: 'qr_misplaced', expected }
  }
  return orientationMismatch(image, layout.pageSize) ? { kind: 'aspect_mismatch' } : { kind: 'ok' }
}

/** Where a point lands after the image is turned `quarterTurns` × 90° clockwise, matching `rotateBitmap`. */
export function rotatePoint(p: Point, quarterTurns: number, size: { width: number; height: number }): Point {
  const k = ((quarterTurns % 4) + 4) % 4
  let { x, y } = p
  let { width, height } = size
  for (let i = 0; i < k; i++) {
    ;[x, y] = [height - y, x]
    ;[width, height] = [height, width]
  }
  return { x, y }
}

/** QR corners after the image is turned, so a rotated scan needs no second QR read. */
export function rotateQrCorners(qr: QrCornersPx, quarterTurns: number, size: { width: number; height: number }): QrCornersPx {
  return {
    topLeft: rotatePoint(qr.topLeft, quarterTurns, size),
    topRight: rotatePoint(qr.topRight, quarterTurns, size),
    bottomRight: rotatePoint(qr.bottomRight, quarterTurns, size),
    bottomLeft: rotatePoint(qr.bottomLeft, quarterTurns, size),
  }
}
