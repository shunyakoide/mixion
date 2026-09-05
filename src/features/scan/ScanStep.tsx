import { useScanStore } from '../../app/scanStore'
import { layoutFromSettings } from '../../domain/settings'
import { ExportPanel } from '../animate/ExportPanel'
import { OriginalDrop } from '../animate/OriginalDrop'
import { Player } from '../animate/Player'
import { useResolvedFrames } from '../animate/useResolvedFrames'
import { CornerPicker } from './CornerPicker'
import { FrameStrip } from './FrameStrip'
import { ScanList } from './ScanList'
import { SettingsBar } from './SettingsBar'

export function ScanStep() {
  const { settings, scans, selectedId } = useScanStore()
  const selected = scans.find((s) => s.id === selectedId) ?? null
  const layout = settings ? layoutFromSettings(settings) : null
  const { resolved } = useResolvedFrames()

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <SettingsBar />
        <OriginalDrop />
      </div>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr_260px]">
        <ScanList />
        <div>
          {selected && settings && layout ? (
            selected.status === 'reading' ? (
              <p className="text-sm text-neutral-500">読み込み中…</p>
            ) : (
              <CornerPicker key={selected.id} scan={selected} settings={settings} layout={layout} />
            )
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-sm text-neutral-400">
              {settings ? 'スキャンを選択してください' : 'スキャンを取り込むと QR から設定を復元します'}
            </div>
          )}
        </div>
        {settings && (
          <div className="space-y-5">
            <FrameStrip settings={settings} />
            <Player settings={settings} resolved={resolved} />
            <ExportPanel settings={settings} resolved={resolved} />
          </div>
        )}
      </div>
    </div>
  )
}
