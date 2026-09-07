import { startOver } from './app/demo'
import { Steps } from './app/Steps'
import { useScanStore } from './app/scanStore'
import { useAppStore } from './app/store'
import { useUnloadGuard } from './app/useUnloadGuard'
import { LanguageToggle } from './i18n/LanguageToggle'
import { useT } from './i18n'
import { AnimateStep } from './features/animate/AnimateStep'
import { PrintStep } from './features/print/PrintStep'
import { ScanStep } from './features/scan/ScanStep'
import { Logo } from './components/ui/Logo'

export default function App() {
  const step = useAppStore((s) => s.step)
  const sample = useAppStore((s) => s.sample)
  const hasVideo = useAppStore((s) => s.file !== null)
  const hasScans = useScanStore((s) => s.scans.length > 0)
  const t = useT()
  useUnloadGuard()

  // The logo goes back to the start page. Real work is only dropped after a confirmation.
  const goHome = () => {
    if (!sample && (hasVideo || hasScans) && !window.confirm(t.header.startOverConfirm)) return
    startOver()
  }
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-10 border-b border-rule bg-white/92 backdrop-blur-[12px]">
        <div className="mx-auto flex h-15 max-w-[1280px] items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <button
            type="button"
            onClick={goHome}
            title={t.header.home}
            className="flex shrink-0 items-center gap-[5px] rounded-md font-logo text-2xl font-bold leading-none tracking-[-0.04em] transition-opacity hover:opacity-70"
          >
            <Logo size={24} />
            mixion
          </button>
          <Steps />
          <div className="flex shrink-0 items-center gap-2">
            {sample && (
              <button
                type="button"
                onClick={startOver}
                className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-rule-2 bg-white px-3.5 text-[13px] text-ink transition-colors hover:border-ink-3"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />
                <span className="sm:hidden">{t.header.samplePillShort}</span>
                <span className="hidden sm:inline">{t.header.samplePill}</span>
              </button>
            )}
            <LanguageToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-7 sm:px-6 sm:pt-9">
        {step === 'print' ? <PrintStep /> : step === 'scan' ? <ScanStep /> : <AnimateStep />}
      </main>
    </div>
  )
}
