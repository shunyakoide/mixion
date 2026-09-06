import { leaveSample } from './app/demo'
import { StepBar } from './app/StepBar'
import { Steps } from './app/Steps'
import { useAppStore } from './app/store'
import { useUnloadGuard } from './app/useUnloadGuard'
import { AnimateStep } from './features/animate/AnimateStep'
import { PrintStep } from './features/print/PrintStep'
import { ScanStep } from './features/scan/ScanStep'
import { VideoSpike } from './features/spike/VideoSpike'

export default function App() {
  const step = useAppStore((s) => s.step)
  const sample = useAppStore((s) => s.sample)
  useUnloadGuard()
  const spike = import.meta.env.DEV && new URLSearchParams(location.search).get('spike')
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-10 border-b border-rule bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-8 px-6 py-3">
          <span className="text-lg font-semibold tracking-tight">Mixion</span>
          <Steps />
          {sample && (
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="text-ink-2">サンプルで試しています</span>
              <button type="button" onClick={leaveSample} className="rounded-md border border-rule-2 px-3 py-1.5 text-ink hover:border-ink-3">
                最初のページに戻る
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-6 pb-28 pt-8">
        {spike === 'video' ? <VideoSpike /> : step === 'print' ? <PrintStep /> : step === 'scan' ? <ScanStep /> : <AnimateStep />}
      </main>
      <StepBar />
    </div>
  )
}
