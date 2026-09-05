import { useState } from 'react'
import { useScanStore } from '../../app/scanStore'
import { Button } from '../../components/ui/Button'
import { GRID_PRESETS, parseGrid, type GridPreset } from '../../domain/layout'
import { FPS_MAX, FPS_MIN, isValidFps, type ProjectSettings } from '../../domain/settings'
import { framesPerPage, pageCount } from '../../domain/frameMap'

/** Shows the settings restored from the QR, or a small form to enter them by hand. */
export function SettingsBar() {
  const { settings, settingsSource, setManualSettings, clearSettings, scans } = useScanStore()
  const [open, setOpen] = useState(false)

  if (settings && !open) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-neutral-100 px-4 py-2 text-sm">
        <span className="font-medium">Project {settings.projectId}</span>
        <span>{settings.fps} fps</span>
        <span>{settings.grid.cols}×{settings.grid.rows}</span>
        <span>{settings.frameCount} frames / {settings.pageCount} pages</span>
        <span>{settings.dims.width}×{settings.dims.height}</span>
        <span className="text-neutral-500">{settingsSource === 'qr' ? 'QR から復元' : '手入力'}</span>
        <button type="button" className="ml-auto text-neutral-500 underline" onClick={() => setOpen(true)}>
          変更
        </button>
      </div>
    )
  }

  return <ManualForm initial={settings} onSubmit={(s) => { setManualSettings(s); setOpen(false) }} onCancel={settings ? () => setOpen(false) : undefined} onClear={scans.length === 0 && settings ? clearSettings : undefined} />
}

function ManualForm({ initial, onSubmit, onCancel, onClear }: { initial: ProjectSettings | null; onSubmit: (s: ProjectSettings) => void; onCancel?: () => void; onClear?: () => void }) {
  const [fps, setFps] = useState(String(initial?.fps ?? 8))
  const [gridKey, setGridKey] = useState<string>(initial ? `${initial.grid.cols}x${initial.grid.rows}` : '2x2')
  const [frames, setFrames] = useState(String(initial?.frameCount ?? 40))
  const [w, setW] = useState(String(initial?.dims.width ?? 1920))
  const [h, setH] = useState(String(initial?.dims.height ?? 1080))
  const [projectId, setProjectId] = useState(initial?.projectId ?? 'manual')

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
  const field = 'w-24 rounded border border-neutral-300 px-2 py-1 text-sm'

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
      <div className="mb-3 text-neutral-600">QR が読めない場合は、印刷時の設定を入力してください（ページのヘッダに印刷されています）。</div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          fps
          <input className={field} type="number" min={FPS_MIN} max={FPS_MAX} value={fps} onChange={(e) => setFps(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          Grid
          <select className={field} value={gridKey} onChange={(e) => setGridKey(e.target.value)}>
            {(Object.keys(GRID_PRESETS) as GridPreset[]).map((k) => (
              <option key={k} value={k}>
                {k.replace('x', '×')}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          総フレーム数
          <input className={field} type="number" min={1} value={frames} onChange={(e) => setFrames(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          幅 px
          <input className={field} type="number" min={2} value={w} onChange={(e) => setW(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          高さ px
          <input className={field} type="number" min={2} value={h} onChange={(e) => setH(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          Project ID
          <input className={field} value={projectId} onChange={(e) => setProjectId(e.target.value)} />
        </label>
        <Button onClick={submit} disabled={!valid}>
          設定する
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
        )}
        {onClear && (
          <Button variant="secondary" onClick={onClear}>
            クリア
          </Button>
        )}
      </div>
    </div>
  )
}
