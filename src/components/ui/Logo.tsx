/** The Mixion mark: two stacked print pages with a single pen stroke. Inherits `currentColor`. */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect x="7" y="2" width="22" height="22" rx="3" fill="#f5f5f3" stroke="currentColor" strokeWidth="2.5" />
      <rect x="2.5" y="7.5" width="22" height="22" rx="3" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
      <path d="M8 24 L19 13" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}
