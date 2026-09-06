import type { ReactNode } from 'react'

interface ChipProps {
  selected: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}

/** One option in a small set. Selected is solid black; the rest sit on the surface tint with no border. */
export function Chip({ selected, onClick, children, disabled }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'h-10 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors duration-150 disabled:opacity-35',
        selected ? 'bg-ink text-white' : 'bg-surface text-ink hover:bg-rule',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
