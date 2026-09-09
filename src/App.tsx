import { useMemo } from 'react'
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
import { missingFeatures } from './lib/support'

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
            className="flex shrink-0 items-center gap-[5px] rounded-md font-logo text-2xl font-bold leading-none tracking-[-0.04em] transition-opacity hover:opacity-70"
          >
            <Logo size={24} />
            <span className="hidden sm:inline">mixion</span>
          </button>
          <Steps />
          <LanguageToggle className="shrink-0" />
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-7 sm:px-6 sm:pt-9">
        {missing.length > 0 ? <Unsupported missing={missing} /> : step === 'print' ? <PrintStep /> : step === 'scan' ? <ScanStep /> : <AnimateStep />}
      </main>
    </div>
  )
}
