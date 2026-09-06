import { markerId, markerModules } from '../../domain/markers'
import type { Corner } from '../../domain/layout'

/** The actual corner marker of a page, as a small inline SVG, so people know what to click. */
export function MarkerGlyph({ page, corner, size = 22, className = '' }: { page: number | null; corner: Corner; size?: number; className?: string }) {
  const id = page !== null ? markerId(page, corner) : corner
  const grid = markerModules(id)
  const n = grid.length
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} className={className} aria-hidden shapeRendering="crispEdges">
      <rect x={0} y={0} width={n} height={n} fill="#fff" />
      {grid.flatMap((row, r) => row.map((black, c) => (black ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#000" /> : null)))}
    </svg>
  )
}
