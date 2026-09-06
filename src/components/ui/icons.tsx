import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size: number, rest: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  ...rest,
})

export const Check = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
export const ChevronLeft = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="m15 18-6-6 6-6" />
  </svg>
)
export const ChevronRight = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="m9 18 6-6-6-6" />
  </svg>
)
export const ArrowRight = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
)
export const Upload = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M12 3v12" />
    <path d="m7 8 5-5 5 5" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
)
export const Film = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
  </svg>
)
export const Scan = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M4 12h16" />
  </svg>
)
export const Play = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none" />
  </svg>
)
export const Pause = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}>
    <rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none" />
    <rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none" />
  </svg>
)
export const Spinner = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)} className={`animate-spin ${r.className ?? ''}`}>
    <path d="M21 12a9 9 0 1 1-6.2-8.56" />
  </svg>
)
export const X = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)
export const RotateCw = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
)
