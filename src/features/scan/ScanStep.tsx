import { useMemo } from 'react'
import { useScanStore } from '../../app/scanStore'
import { useAppStore } from '../../app/store'
import { Button } from '../../components/ui/Button'
import { ArrowRight, Check } from '../../components/ui/icons'
import { layoutFromSettings } from '../../domain/settings'
import { useT } from '../../i18n'
import { CornerPicker } from './CornerPicker'
import { ScanProgress } from './ScanProgress'
import { ScanEmpty } from './ScanEmpty'
import { ScanList } from './ScanList'
import { SettingsBar } from './SettingsBar'

export function ScanStep() {
  const { settings, scans, selectedId, outputFrames } = useScanStore()
  const setStep = useAppStore((s) => s.setStep)
  const t = useT()
  const allDone = settings !== null && outputFrames.size >= settings.frameCount
  const selected = scans.find((s) => s.id === selectedId) ?? null
  // Memoised so the corner picker, which redraws when the layout changes, does not redraw on every store update.
  const layout = useMemo(() => (settings ? layoutFromSettings(settings) : null), [settings])

  if (scans.length === 0 && !settings) return <ScanEmpty />

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[32px] font-semibold leading-9 tracking-[-0.03em]">{t.scan.emptyTitle}</h1>
          <p className="mt-2.5 max-w-[52ch] text-pretty text-sm leading-[22px] text-ink-2">{t.scan.loadedIntro}</p>
        </div>
        <SettingsBar />
      </div>
      {settings && outputFrames.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-full bg-surface py-2 pl-5 pr-2 text-sm" aria-live="polite">
          {allDone && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-white">
              <Check size={12} strokeWidth={3} />
            </span>
          )}
          <span className="font-medium">{allDone ? t.scan.allDone(settings.frameCount) : t.scan.partialDone(outputFrames.size, settings.frameCount)}</span>
          <Button className="ml-auto" onClick={() => setStep('animate')}>
            {t.scan.goAnimate} <ArrowRight size={16} />
          </Button>
        </div>
      )}
      <div className="grid items-start gap-7 lg:grid-cols-[240px_minmax(0,1fr)_200px]">
        <ScanList />
        <div className="min-w-0">
          {selected && settings && layout ? (
            selected.status === 'reading' || selected.status === 'detecting' ? (
              <div className="flex aspect-[297/210] items-center justify-center rounded-2xl bg-surface text-sm text-ink-2">
                {selected.status === 'detecting' ? t.scan.detectingMarkers : t.common.loading}
              </div>
            ) : (
              <CornerPicker key={selected.id} scan={selected} settings={settings} layout={layout} />
            )
          ) : (
            <div className="flex h-64 items-center justify-center rounded-2xl bg-surface text-sm text-ink-3">{t.scan.selectPage}</div>
          )}
        </div>
        <div>{settings && <ScanProgress settings={settings} />}</div>
      </div>
    </div>
  )
}
