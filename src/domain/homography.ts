/**
 * Planar homography from four point correspondences (DLT with h33 = 1),
 * plus application and inversion. Used to map page millimetres to scan
 * pixels from the four corner markers. Pure TypeScript.
 */
import type { Corner, Layout, Point } from './layout'

/** Row-major 3x3 matrix. */
export type Homography = readonly [number, number, number, number, number, number, number, number, number]

/** Solve A x = b for an n×n system with partial pivoting. Throws when singular. */
export function solveLinear(a: number[][], b: number[]): number[] {
  const n = b.length
  const m = a.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
    if (Math.abs(m[pivot][col]) < 1e-12) throw new Error('singular system (are the points collinear?)')
    if (pivot !== col) [m[col], m[pivot]] = [m[pivot], m[col]]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = m[r][col] / m[col][col]
      if (f === 0) continue
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c]
    }
  }
  return m.map((row, i) => row[n] / row[i])
}

/**
 * Homography H such that H · src[i] ≈ dst[i] for the four pairs.
 * Points must be in the same order in both arrays.
 */
export function solveHomography(src: readonly Point[], dst: readonly Point[]): Homography {
  if (src.length !== 4 || dst.length !== 4) throw new Error('exactly 4 point pairs are required')
  const a: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]
    const { x: u, y: v } = dst[i]
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  const h = solveLinear(a, b)
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

export function applyHomography(h: Homography, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8]
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w }
}

export function invertHomography(h: Homography): Homography {
  const [a, b, c, d, e, f, g, hh, i] = h
  const A = e * i - f * hh
  const B = -(d * i - f * g)
  const C = d * hh - e * g
  const det = a * A + b * B + c * C
  if (Math.abs(det) < 1e-15) throw new Error('homography is not invertible')
  const inv = [
    A / det,
    -(b * i - c * hh) / det,
    (b * f - c * e) / det,
    B / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    C / det,
    -(a * hh - b * g) / det,
    (a * e - b * d) / det,
  ]
  // Normalise so the last entry is 1 (keeps values comparable).
  const s = inv[8]
  return inv.map((v) => v / s) as unknown as Homography
}

export function composeHomography(outer: Homography, inner: Homography): Homography {
  const r: number[] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      r.push(outer[row * 3] * inner[col] + outer[row * 3 + 1] * inner[3 + col] + outer[row * 3 + 2] * inner[6 + col])
    }
  }
  return r as unknown as Homography
}

/** Marker centres in page mm, in corner order 0..3. */
function markerCentersMm(layout: Layout): Point[] {
  return layout.markers.map((m) => m.center)
}

/**
 * Homography from page mm to scan pixels, given where the four marker
 * centres were found (clicked or detected) on the scan.
 */
export function pageToScanHomography(layout: Layout, cornersPx: Record<Corner, Point>): Homography {
  const src = markerCentersMm(layout)
  const dst = layout.markers.map((m) => cornersPx[m.corner])
  return solveHomography(src, dst)
}

/** Project a page-mm rectangle to a scan-pixel polygon (TL, TR, BR, BL). */
export function projectRect(h: Homography, rect: { x: number; y: number; w: number; h: number }): Point[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ].map((p) => applyHomography(h, p))
}

/** Root-mean-square reprojection error in destination units. */
export function reprojectionError(h: Homography, src: readonly Point[], dst: readonly Point[]): number {
  let sum = 0
  for (let i = 0; i < src.length; i++) {
    const p = applyHomography(h, src[i])
    sum += (p.x - dst[i].x) ** 2 + (p.y - dst[i].y) ** 2
  }
  return Math.sqrt(sum / src.length)
}
