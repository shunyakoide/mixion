import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-6 text-[15px] font-semibold',
}

/** Pill buttons. `primary` is the one black action on a screen; `secondary` is the quiet white outline. */
export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const base = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35'
  const look =
    variant === 'primary'
      ? 'bg-ink text-white hover:bg-[#2a2a2a] disabled:hover:bg-ink'
      : variant === 'secondary'
        ? 'border border-rule-2 bg-white text-ink hover:border-ink-3'
        : 'bg-transparent text-ink-2 hover:bg-surface hover:text-ink'
  return <button type="button" className={`${base} ${SIZE[size]} ${look} ${className}`} {...rest} />
}
