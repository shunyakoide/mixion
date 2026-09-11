import { useMemo, type ReactNode } from 'react'
import { Steps } from './app/Steps'
import { Unsupported } from './app/Unsupported'
import { useAppStore } from './app/store'
import { useStartOver } from './app/useStartOver'
import { useUnloadGuard } from './app/useUnloadGuard'
import { LanguageToggle } from './i18n/LanguageToggle'
import { useT } from './i18n'
import { AnimateStep } from './features/animate/AnimateStep'
import { PrintStep } from './features/print/PrintStep'
import { ScanStep } from './features/scan/ScanStep'
import { Logo } from './components/ui/Logo'
import { GitHub } from './components/ui/icons'
import { missingFeatures } from './lib/support'

const REPO_URL = 'https://github.com/shunyakoide/mixion'

export default function App() {
  const step = useAppStore((s) => s.step)
  const t = useT()
  const goHome = useStartOver()
  const missing = useMemo(() => missingFeatures(), [])
  useUnloadGuard()
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-10 border-b border-rule bg-white/92 backdrop-blur-[12px]">
        <div className="mx-auto flex h-15 max-w-[1280px] items-center gap-2 px-4 sm:gap-6 sm:px-6">
          <button
            type="button"
            onClick={goHome}
            title={t.header.home}
            className="flex shrink-0 items-center gap-[5px] rounded-md font-logo text-xl font-bold leading-none tracking-[-0.04em] transition-opacity hover:opacity-70 sm:text-2xl"
          >
            <Logo size={24} />
            <span>mixion</span>
          </button>
          <Steps />
          <div className="flex shrink-0 items-center">
            <LanguageToggle />
            <SourceLink className="hidden h-9 w-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface hover:text-ink sm:flex">
              <GitHub size={18} />
            </SourceLink>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-7 sm:px-6 sm:pt-9">
        {missing.length > 0 ? <Unsupported missing={missing} /> : step === 'print' ? <PrintStep /> : step === 'scan' ? <ScanStep /> : <AnimateStep />}
      </main>
      {/* On phones the header has no room for the link without hiding the current step's label, so it moves down here. */}
      <footer className="flex justify-center pb-8 sm:hidden">
        <SourceLink className="flex items-center gap-1.5 text-[13px] text-ink-3 transition-colors hover:text-ink">
          <GitHub size={14} />
          GitHub
        </SourceLink>
      </footer>
    </div>
  )
}

/** Opens in a new tab, so following it never drops work in progress (see useUnloadGuard). */
function SourceLink({ className, children }: { className: string; children: ReactNode }) {
  const t = useT()
  return (
    <a href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label={t.header.source} title={t.header.source} className={className}>
      {children}
    </a>
  )
}
