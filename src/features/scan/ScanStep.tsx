import { useScanStore } from '../../app/scanStore'
import { useAppStore } from '../../app/store'
import { Button } from '../../components/ui/Button'
import { ArrowRight, Check } from '../../components/ui/icons'
import { layoutFromSettings } from '../../domain/settings'
import { CornerPicker } from './CornerPicker'
import { FrameStrip } from './FrameStrip'
import { ScanEmpty } from './ScanEmpty'
import { ScanList } from './ScanList'
import { SettingsBar } from './SettingsBar'

export function ScanStep() {
  const { settings, scans, selectedId, outputFrames } = useScanStore()
  const setStep = useAppStore((s) => s.setStep)
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
          <span className="font-medium">{settings.frameCount} / {settings.frameCount} フレームが揃いました</span>
          <Button className="ml-auto h-9" onClick={() => setStep('animate')}>
            Animate で再生・書き出し <ArrowRight className="ml-1" />
          </Button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr_220px]">
        <ScanList />
        <div>
          {selected && settings && layout ? (
            selected.status === 'reading' ? (
              <p className="text-sm text-ink-2">読み込み中…</p>
            ) : (
              <CornerPicker key={selected.id} scan={selected} settings={settings} layout={layout} />
            )
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-rule-2 text-sm text-ink-3">
              左の一覧からページを選んでください
            </div>
          )}
        </div>
        <div>{settings && <FrameStrip settings={settings} />}</div>
      </div>
    </div>
  )
}
