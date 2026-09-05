import { useCallback, useState } from 'react'
import { useAppStore } from '../../app/store'
import { useScanStore } from '../../app/scanStore'
import { Button } from '../../components/ui/Button'
import { FrameStrip } from './FrameStrip'
import { ExportPanel } from './ExportPanel'
import { OriginalDrop } from './OriginalDrop'
import { Player } from './Player'
import { useResolvedFrames } from './useResolvedFrames'

export function AnimateStep() {
  const settings = useScanStore((s) => s.settings)
  const applied = useScanStore((s) => s.outputFrames.size)
  const setStep = useAppStore((s) => s.setStep)
  const { resolved } = useResolvedFrames()
  const [seek, setSeek] = useState<{ index: number; nonce: number } | null>(null)
  const [current, setCurrent] = useState(0)
  const onFrame = useCallback((i: number) => setCurrent(i), [])

  if (!settings || applied === 0) {
    return (
      <div className="mx-auto max-w-xl pt-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">まだ動画にするコマがありません</h1>
        <p className="mt-2 text-ink-2">Scan でページを取り込み、四隅を指定して Apply すると、ここで再生と書き出しができます。</p>
        <Button className="mt-6" onClick={() => setStep('scan')}>
          Scan へ
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Player settings={settings} resolved={resolved} seek={seek} onFrame={onFrame} />
        <FrameStrip settings={settings} resolved={resolved} current={current} onSelect={(i) => setSeek({ index: i, nonce: Date.now() })} />
      </div>
      <div className="space-y-5">
        <OriginalDrop />
        <ExportPanel settings={settings} resolved={resolved} />
      </div>
    </div>
  )
}
