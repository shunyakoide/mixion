import { useCallback, useState } from 'react'
import { useAppStore } from '../../app/store'
import { useScanStore } from '../../app/scanStore'
import { Button } from '../../components/ui/Button'
import { FrameStrip } from './FrameStrip'
import { ExportPanel } from './ExportPanel'
import { OriginalDrop } from './OriginalDrop'
import { Player } from './Player'
import { useResolvedFrames } from './useResolvedFrames'
import { useT } from '../../i18n'

export function AnimateStep() {
  const settings = useScanStore((s) => s.settings)
  const applied = useScanStore((s) => s.outputFrames.size)
  const setStep = useAppStore((s) => s.setStep)
  const { resolved } = useResolvedFrames()
  const [seek, setSeek] = useState<{ index: number; nonce: number } | null>(null)
  const [current, setCurrent] = useState(0)
  const onFrame = useCallback((i: number) => setCurrent(i), [])
  const t = useT()

  if (!settings || applied === 0) {
    return (
      <div className="mx-auto max-w-xl pt-8 text-center sm:pt-16">
        <h1 className="text-[32px] font-semibold leading-9 tracking-[-0.03em]">{t.animate.emptyTitle}</h1>
        <p className="mx-auto mt-3 max-w-[48ch] text-pretty text-sm leading-[22px] text-ink-2">{t.animate.emptyBody}</p>
        <Button size="lg" className="mt-8 min-w-48" onClick={() => setStep('scan')}>
          {t.animate.goScan}
        </Button>
      </div>
    )
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Player settings={settings} resolved={resolved} seek={seek} onFrame={onFrame} />
        <FrameStrip settings={settings} resolved={resolved} current={current} onSelect={(i) => setSeek({ index: i, nonce: Date.now() })} />
      </div>
      <div className="flex flex-col gap-6 lg:sticky lg:top-[84px]">
        <div>
          <h1 className="text-[32px] font-semibold leading-9 tracking-[-0.03em]">{t.animate.title}</h1>
          <p className="mt-2.5 text-sm leading-[22px] text-ink-2">
            {t.animate.summary(settings.frameCount, settings.fps, (settings.frameCount / settings.fps).toFixed(1), settings.dims.width, settings.dims.height)}
          </p>
        </div>
        <OriginalDrop />
        <ExportPanel settings={settings} resolved={resolved} />
      </div>
    </div>
  )
}
