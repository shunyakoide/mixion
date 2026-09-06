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
  const layout = settings ? layoutFromSettings(settings) : null

  if (scans.length === 0 && !settings) return <ScanEmpty />

  return (
    <div className="space-y-4">
      <SettingsBar />
      {allDone && settings && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ok/30 bg-ok-soft px-4 py-3 text-sm" aria-live="polite">
          <Check className="text-ok" />
          <span className="font-medium">{t.scan.allDone(settings.frameCount)}</span>
          <Button className="ml-auto h-9" onClick={() => setStep('animate')}>
            {t.scan.goAnimate} <ArrowRight className="ml-1" />
          </Button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_220px]">
        <ScanList />
        <div className="min-w-0">
          {selected && settings && layout ? (
            selected.status === 'reading' || selected.status === 'detecting' ? (
              <p className="text-sm text-ink-2">{selected.status === 'detecting' ? t.scan.detectingMarkers : t.common.loading}</p>
            ) : (
              <CornerPicker key={selected.id} scan={selected} settings={settings} layout={layout} />
            )
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-rule-2 text-sm text-ink-3">
              {t.scan.selectPage}
            </div>
          )}
        </div>
        <div>{settings && <ScanProgress settings={settings} />}</div>
      </div>
    </div>
  )
}
