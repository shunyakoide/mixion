import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

export function Button({ variant = 'primary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base = 'inline-flex min-h-11 items-center sm:min-h-10 justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40'
  const look =
    variant === 'primary'
      ? 'bg-accent text-white hover:bg-accent-2'
      : variant === 'secondary'
        ? 'border border-rule-2 bg-panel text-ink hover:border-ink-3'
        : 'text-ink-2 hover:bg-rule/60'
  return <button type="button" className={`${base} ${look} ${className}`} {...rest} />
}
