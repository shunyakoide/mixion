import type { ReactNode } from 'react'

interface ChipProps {
  selected: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}

export function Chip({ selected, onClick, children, disabled }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'min-h-11 rounded-md border px-3 text-sm transition-colors disabled:opacity-40 sm:min-h-9',
        selected ? 'border-ink bg-ink text-white' : 'border-rule-2 bg-panel text-ink-2 hover:border-ink-3 hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
