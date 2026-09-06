import { lazy, Suspense } from 'react'
import { leaveSample } from './app/demo'
import { StepBar } from './app/StepBar'
import { Steps } from './app/Steps'
import { useAppStore } from './app/store'
import { useUnloadGuard } from './app/useUnloadGuard'
import { LanguageToggle } from './i18n/LanguageToggle'
import { useT } from './i18n'
import { AnimateStep } from './features/animate/AnimateStep'
import { PrintStep } from './features/print/PrintStep'
import { ScanStep } from './features/scan/ScanStep'

// Dev-only: the static import would pull the spike page and its fixture video into the production bundle.
const VideoSpike = import.meta.env.DEV ? lazy(() => import('./features/spike/VideoSpike').then((m) => ({ default: m.VideoSpike }))) : null

export default function App() {
  const step = useAppStore((s) => s.step)
  const sample = useAppStore((s) => s.sample)
  const t = useT()
  useUnloadGuard()
  const spike = import.meta.env.DEV && new URLSearchParams(location.search).get('spike')
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-10 border-b border-rule bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2 sm:gap-8 sm:px-6 sm:py-3">
          <span className="shrink-0 text-base font-semibold tracking-tight sm:text-lg">Mixion</span>
          <Steps />
          <div className="ml-auto flex shrink-0 items-center gap-2 text-sm sm:gap-3">
            {sample && (
              <>
                <span className="hidden text-ink-2 md:inline">{t.header.sampleMode}</span>
                <button type="button" onClick={leaveSample} className="min-h-11 whitespace-nowrap rounded-md border border-rule-2 px-3 text-ink hover:border-ink-3 sm:min-h-9">
                  <span className="sm:hidden">{t.header.backToStartShort}</span>
                  <span className="hidden sm:inline">{t.header.backToStart}</span>
                </button>
              </>
            )}
            <LanguageToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 pb-32 pt-5 sm:px-6 sm:pt-8">
        {spike === 'video' && VideoSpike ? (
          <Suspense fallback={null}>
            <VideoSpike />
          </Suspense>
        ) : step === 'print' ? <PrintStep /> : step === 'scan' ? <ScanStep /> : <AnimateStep />}
      </main>
      <StepBar />
    </div>
  )
}
