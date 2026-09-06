import type { QrCornersPx } from './detectMarkers'

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
