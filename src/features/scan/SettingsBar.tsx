import { useState } from 'react'
import { useScanStore } from '../../app/scanStore'
import { Button } from '../../components/ui/Button'
import { GRID_PRESETS, parseGrid, type GridPreset } from '../../domain/layout'
import { FPS_MAX, FPS_MIN, isValidFps, type ProjectSettings } from '../../domain/settings'
import { framesPerPage, pageCount } from '../../domain/frameMap'
import { useT } from '../../i18n'

/** Shows the settings restored from the QR as one pill, or a small form to enter them by hand. */
export function SettingsBar() {
  const { settings, settingsSource, setManualSettings, clearSettings, scans } = useScanStore()
  const [open, setOpen] = useState(false)
  const t = useT()

  if (settings && !open) {
    return (
      <div className="flex h-10 max-w-full items-center gap-3.5 overflow-x-auto whitespace-nowrap rounded-full bg-surface pl-4 pr-2 font-mono text-xs text-[#3c3c3a]">
        <span className="font-medium text-ink">{settings.projectId}</span>
        <span>{settings.fps}fps</span>
        <span>{settings.grid.cols}×{settings.grid.rows}</span>
        <span>{settings.frameCount} / {settings.pageCount}p</span>
        <span>{settings.dims.width}×{settings.dims.height}</span>
        <span className="text-ink-3">{settingsSource === 'qr' ? t.scan.fromQr : t.scan.enteredByHand}</span>
        <button type="button" className="h-7 rounded-full bg-white px-2.5 font-sans text-xs text-ink transition-colors hover:bg-rule" onClick={() => setOpen(true)}>
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
  const field = 'h-10 w-24 rounded-full bg-white px-4 font-mono text-sm text-ink'
  const label = 'flex flex-col gap-1.5 text-[13px] font-semibold tracking-[0.02em]'

  return (
    <div className="w-full basis-full rounded-[20px] bg-surface p-5 text-sm">
      <div className="mb-4 text-sm leading-[22px] text-ink-2">{t.scan.manualIntro}</div>
      <div className="flex flex-wrap items-end gap-4">
        <label className={label}>
          fps
          <input className={field} type="number" min={FPS_MIN} max={FPS_MAX} value={fps} onChange={(e) => setFps(e.target.value)} />
        </label>
        <label className={label}>
          {t.scan.grid}
          <select className={field} value={gridKey} onChange={(e) => setGridKey(e.target.value)}>
            {(Object.keys(GRID_PRESETS) as GridPreset[]).map((k) => (
              <option key={k} value={k}>
                {k.replace('x', '×')}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t.scan.totalFrames}
          <input className={field} type="number" min={1} value={frames} onChange={(e) => setFrames(e.target.value)} />
        </label>
        <label className={label}>
          {t.scan.widthPx}
          <input className={field} type="number" min={2} value={w} onChange={(e) => setW(e.target.value)} />
        </label>
        <label className={label}>
          {t.scan.heightPx}
          <input className={field} type="number" min={2} value={h} onChange={(e) => setH(e.target.value)} />
        </label>
        <label className={label}>
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
          <Button variant="ghost" onClick={onClear}>
            {t.common.clear}
          </Button>
        )}
      </div>
    </div>
  )
}
