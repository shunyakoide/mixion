/** The Mixion mark: a print cell with the corner marker the scanner looks for. Inherits `currentColor`. */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect x="2.5" y="2.5" width="27" height="27" rx="6" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="8" y="8" width="8" height="8" fill="currentColor" />
    </svg>
  )
}
