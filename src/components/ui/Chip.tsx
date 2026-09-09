import type { ReactNode } from 'react'

interface ChipProps {
  selected: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  /** `sm` for a row of options inside a panel. */
  size?: 'md' | 'sm'
  /** `panel` when the chip sits on a surface-tinted panel, so the unselected ones stay visible. */
  tone?: 'page' | 'panel'
}

/** One option in a small set. Selected is solid black; the rest sit on a light tint with no border. */
export function Chip({ selected, onClick, children, disabled, size = 'md', tone = 'page' }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'whitespace-nowrap rounded-full font-medium transition-colors duration-150 disabled:opacity-35',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        selected ? 'bg-ink text-white' : tone === 'panel' ? 'bg-white text-ink hover:bg-rule' : 'bg-surface text-ink hover:bg-rule',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
