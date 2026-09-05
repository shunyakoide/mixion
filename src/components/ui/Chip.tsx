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
        'rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50',
        selected ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
