import type { Corner, Point } from '../../domain/layout'

/** Which corner a click means, from where it lands on the scan. Click order then does not matter. */
export function cornerFromPosition(p: Point, width: number, height: number): Corner {
  const left = p.x < width / 2
  const top = p.y < height / 2
  if (top) return left ? 0 : 1
  return left ? 3 : 2
}

/** True when TL→TR→BR→BL goes clockwise around a convex shape, i.e. the four points are labelled consistently. */
export function cornersConsistent(c: Partial<Record<Corner, Point>>): boolean {
  const pts = [c[0], c[1], c[2], c[3]]
  if (pts.some((q) => q === undefined)) return true
  const q = pts as Point[]
  for (let i = 0; i < 4; i++) {
    const a = q[i]
    const b = q[(i + 1) % 4]
    const d = q[(i + 2) % 4]
    const cross = (b.x - a.x) * (d.y - b.y) - (b.y - a.y) * (d.x - b.x)
    if (cross <= 0) return false
  }
  return true
}
