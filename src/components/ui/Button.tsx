import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary'

export function Button({ variant = 'primary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'
  const look = variant === 'primary' ? 'bg-neutral-900 text-white hover:bg-neutral-700' : 'border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500'
  return <button type="button" className={`${base} ${look} ${className}`} {...rest} />
}
