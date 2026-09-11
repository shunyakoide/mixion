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
/** The GitHub mark (Simple Icons, CC0). Filled, unlike the stroked icons above. */
export const GitHub = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}>
    <path
      fill="currentColor"
      stroke="none"
      d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
    />
  </svg>
)
export const RotateCw =({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
)
