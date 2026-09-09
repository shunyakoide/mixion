import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '../../app/store'
import { useScanStore } from '../../app/scanStore'
import { useStartOver } from '../../app/useStartOver'
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
  const onSelect = useCallback((i: number) => setSeek({ index: i, nonce: Date.now() }), [])
  const t = useT()
  const goHome = useStartOver()

  // The stepper only opens Animate with cut frames; if they vanish underneath us, fall back to Scan.
  const ready = settings !== null && applied > 0
  useEffect(() => {
    if (!ready) setStep('scan')
  }, [ready, setStep])
  if (!ready || !settings) return null

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Player settings={settings} resolved={resolved} seek={seek} onFrame={onFrame} />
        <FrameStrip settings={settings} resolved={resolved} current={current} onSelect={onSelect} />
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
        <button type="button" className="-mt-3 self-center py-1 text-center text-[13px] leading-[18px] text-ink-2 underline underline-offset-2 hover:text-ink" onClick={goHome}>
          {t.animate.backToStart}
        </button>
      </div>
    </div>
  )
}
