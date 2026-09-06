import { useState } from 'react'
import { deriveLayout, deriveSettings, useAppStore } from '../../app/store'
import { GRID_PRESETS, type GridPreset } from '../../domain/layout'
import { FPS_MAX, FPS_MIN, FPS_PRESETS, isValidFps } from '../../domain/settings'
import { Chip } from '../../components/ui/Chip'
import { useT } from '../../i18n'

export function SettingsPanel() {
  const { fps, gridKey, setFps, setGrid, info, projectId, status } = useAppStore()
  const busy = status === 'extracting' || status === 'building' || status === 'saving'
  const settings = deriveSettings({ info, fps, gridKey, projectId })
  const layout = deriveLayout(settings)
  const t = useT()
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
        <div className="mb-2 text-sm font-medium">{t.settings.fps}</div>
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
            placeholder={t.settings.customFps}
            disabled={busy}
            aria-label="custom fps"
            className={[
              'h-9 w-24 rounded-md border px-3 text-sm',
              customActive ? 'border-ink bg-ink text-white' : 'border-rule-2 bg-panel',
              custom !== '' && !isValidFps(Number(custom)) ? 'border-danger text-danger' : '',
            ].join(' ')}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">{t.settings.framesPerPage}</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(GRID_PRESETS) as GridPreset[]).map((k) => (
            <Chip key={k} selected={gridKey === k} onClick={() => setGrid(k)} disabled={busy}>
              {k.replace('x', '×')}
            </Chip>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-rule/40 p-3 text-sm" aria-live="polite">
        {settings && layout ? (
          <>
            <div className="text-base font-medium">
              {t.settings.summary(settings.frameCount, settings.pageCount)}
            </div>
            <div className="mt-1 text-ink-2">
              {t.settings.layoutLine(layout.orientation === 'landscape', layout.cells[0].imageRect.w.toFixed(0), layout.cells[0].imageRect.h.toFixed(0), settings.projectId)}
            </div>
          </>
        ) : (
          <div className="text-ink-2">{t.settings.loadVideoFirst}</div>
        )}
      </div>
    </div>
  )
}
