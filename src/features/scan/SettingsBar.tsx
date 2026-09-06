import { useState } from 'react'
import { useScanStore } from '../../app/scanStore'
import { Button } from '../../components/ui/Button'
import { GRID_PRESETS, parseGrid, type GridPreset } from '../../domain/layout'
import { FPS_MAX, FPS_MIN, isValidFps, type ProjectSettings } from '../../domain/settings'
import { framesPerPage, pageCount } from '../../domain/frameMap'
import { useT } from '../../i18n'

/** Shows the settings restored from the QR, or a small form to enter them by hand. */
export function SettingsBar() {
  const { settings, settingsSource, setManualSettings, clearSettings, scans } = useScanStore()
  const [open, setOpen] = useState(false)
  const t = useT()

  if (settings && !open) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-rule/40 px-4 py-2 text-sm">
        <span className="font-medium">Project {settings.projectId}</span>
        <span>{settings.fps} fps</span>
        <span>{settings.grid.cols}×{settings.grid.rows}</span>
        <span>{settings.frameCount} frames / {settings.pageCount} pages</span>
        <span>{settings.dims.width}×{settings.dims.height}</span>
        <span className="text-ink-2">{settingsSource === 'qr' ? t.scan.fromQr : t.scan.enteredByHand}</span>
        <button type="button" className="ml-auto text-ink-2 underline" onClick={() => setOpen(true)}>
          {t.scan.change}
        </button>
      </div>
    )
  }

  return <ManualForm initial={settings} onSubmit={(s) => { setManualSettings(s); setOpen(false) }} onCancel={settings ? () => setOpen(false) : undefined} onClear={scans.length === 0 && settings ? clearSettings : undefined} />
}

function ManualForm({ initial, onSubmit, onCancel, onClear }: { initial: ProjectSettings | null; onSubmit: (s: ProjectSettings) => void; onCancel?: () => void; onClear?: () => void }) {
  const [fps, setFps] = useState(String(initial?.fps ?? 8))
  const [gridKey, setGridKey] = useState<string>(initial ? `${initial.grid.cols}x${initial.grid.rows}` : '4x3')
  const [frames, setFrames] = useState(String(initial?.frameCount ?? 40))
  const [w, setW] = useState(String(initial?.dims.width ?? 1920))
  const [h, setH] = useState(String(initial?.dims.height ?? 1080))
  const [projectId, setProjectId] = useState(initial?.projectId ?? 'manual')
  const t = useT()

  const grid = parseGrid(gridKey)
  const valid = isValidFps(Number(fps)) && grid && Number(frames) >= 1 && Number(w) >= 2 && Number(h) >= 2
  const submit = () => {
    if (!valid || !grid) return
    const frameCount = Math.round(Number(frames))
    onSubmit({
      projectId: projectId.trim() || 'manual',
      paper: 'A4',
      fps: Number(fps),
      grid,
      dims: { width: Math.round(Number(w)), height: Math.round(Number(h)) },
      frameCount,
      pageCount: pageCount(frameCount, framesPerPage(grid)),
    })
  }
  const field = 'w-24 rounded border border-rule-2 px-2 py-1 text-sm'

  return (
    <div className="rounded-lg border border-rule bg-panel p-4 text-sm">
      <div className="mb-3 text-ink-2">{t.scan.manualIntro}</div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          fps
          <input className={field} type="number" min={FPS_MIN} max={FPS_MAX} value={fps} onChange={(e) => setFps(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          {t.scan.grid}
          <select className={field} value={gridKey} onChange={(e) => setGridKey(e.target.value)}>
            {(Object.keys(GRID_PRESETS) as GridPreset[]).map((k) => (
              <option key={k} value={k}>
                {k.replace('x', '×')}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t.scan.totalFrames}
          <input className={field} type="number" min={1} value={frames} onChange={(e) => setFrames(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          {t.scan.widthPx}
          <input className={field} type="number" min={2} value={w} onChange={(e) => setW(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          {t.scan.heightPx}
          <input className={field} type="number" min={2} value={h} onChange={(e) => setH(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          {t.scan.projectId}
          <input className={field} value={projectId} onChange={(e) => setProjectId(e.target.value)} />
        </label>
        <Button onClick={submit} disabled={!valid}>
          {t.scan.useSettings}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        )}
        {onClear && (
          <Button variant="secondary" onClick={onClear}>
            {t.common.clear}
          </Button>
        )}
      </div>
    </div>
  )
}
