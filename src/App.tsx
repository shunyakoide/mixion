import { Steps } from './app/Steps'
import { useAppStore } from './app/store'
import { useUnloadGuard } from './app/useUnloadGuard'
import { DrawStep } from './features/draw/DrawStep'
import { PrintStep } from './features/print/PrintStep'
import { ScanStep } from './features/scan/ScanStep'
import { VideoSpike } from './features/spike/VideoSpike'

export default function App() {
  const step = useAppStore((s) => s.step)
  useUnloadGuard()
  const spike = import.meta.env.DEV && new URLSearchParams(location.search).get('spike')
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold tracking-tight">Mixion</span>
          <Steps />
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">
        {spike === 'video' ? <VideoSpike /> : step === 'print' ? <PrintStep /> : step === 'draw' ? <DrawStep /> : <ScanStep />}
      </main>
    </div>
  )
}
