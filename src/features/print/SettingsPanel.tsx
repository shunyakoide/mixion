import { useState } from 'react'
import { deriveLayout, deriveSettings, useAppStore } from '../../app/store'
import { GRID_PRESETS, type GridPreset } from '../../domain/layout'
import { FPS_MAX, FPS_MIN, FPS_PRESETS, isValidFps } from '../../domain/settings'
import { Chip } from '../../components/ui/Chip'

export function SettingsPanel() {
  const { fps, gridKey, setFps, setGrid, info, projectId, status } = useAppStore()
  const busy = status === 'extracting' || status === 'building' || status === 'saving'
  const settings = deriveSettings({ info, fps, gridKey, projectId })
  const layout = deriveLayout(settings)
  const [custom, setCustom] = useState<string>(FPS_PRESETS.includes(fps as (typeof FPS_PRESETS)[number]) ? '' : String(fps))
  const customActive = custom !== '' && Number(custom) === fps

  const onCustom = (v: string) => {
    setCustom(v)
    const n = Number(v)
    if (v !== '' && isValidFps(n)) setFps(n)
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-sm font-medium">FPS</div>
        <div className="flex flex-wrap items-center gap-2">
          {FPS_PRESETS.map((p) => (
            <Chip key={p} selected={fps === p && !customActive} onClick={() => { setCustom(''); setFps(p) }} disabled={busy}>
              {p} fps
            </Chip>
          ))}
          <input
            type="number"
            min={FPS_MIN}
            max={FPS_MAX}
            step={1}
            value={custom}
            onChange={(e) => onCustom(e.target.value)}
            placeholder="任意"
            disabled={busy}
            aria-label="custom fps"
            className={[
              'w-20 rounded-full border px-3 py-1 text-sm',
              customActive ? 'border-neutral-900' : 'border-neutral-300',
              custom !== '' && !isValidFps(Number(custom)) ? 'border-red-500' : '',
            ].join(' ')}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Frames per Page</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(GRID_PRESETS) as GridPreset[]).map((k) => (
            <Chip key={k} selected={gridKey === k} onClick={() => setGrid(k)} disabled={busy}>
              {k.replace('x', '×')}
            </Chip>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-neutral-100 p-3 text-sm" aria-live="polite">
        {settings && layout ? (
          <>
            <div className="text-base font-medium">
              {settings.frameCount} frames → {settings.pageCount} pages
            </div>
            <div className="mt-1 text-neutral-600">
              A4 {layout.orientation === 'landscape' ? '横' : '縦'} · 1 フレーム {layout.cells[0].imageRect.w.toFixed(0)}×{layout.cells[0].imageRect.h.toFixed(0)} mm · Project {settings.projectId}
            </div>
          </>
        ) : (
          <div className="text-neutral-500">動画を読み込むと枚数が表示されます</div>
        )}
      </div>
    </div>
  )
}
