import { useState } from 'react'
import { deriveLayout, deriveSettings, useAppStore } from '../../app/store'
import { GRID_PRESETS, type GridPreset } from '../../domain/layout'
import { FPS_MAX, FPS_MIN, FPS_PRESETS, isValidFps } from '../../domain/settings'
import { Chip } from '../../components/ui/Chip'
import { ArrowRight } from '../../components/ui/icons'
import { useT } from '../../i18n'

function LabelRow({ label, note }: { label: string; note: string | null }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <span className="whitespace-nowrap text-[13px] font-semibold tracking-[0.02em]">{label}</span>
      {note && <span className="font-mono text-xs text-ink-3">{note}</span>}
    </div>
  )
}

export function SettingsPanel() {
  const { fps, gridKey, setFps, setGrid, info, projectId, status } = useAppStore()
  const busy = status === 'extracting' || status === 'building' || status === 'saving'
  const settings = deriveSettings({ info, fps, gridKey, projectId })
  const layout = deriveLayout(settings)
  const t = useT()
  const [custom, setCustom] = useState<string>(FPS_PRESETS.includes(fps as (typeof FPS_PRESETS)[number]) ? '' : String(fps))
  const customActive = custom !== '' && Number(custom) === fps
  const customInvalid = custom !== '' && !isValidFps(Number(custom))

  const onCustom = (v: string) => {
    setCustom(v)
    const n = Number(v)
    if (v !== '' && isValidFps(n)) setFps(n)
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <div>
          <LabelRow label={t.settings.fps} note={t.settings.fpsRange(FPS_MIN, FPS_MAX)} />
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
              aria-invalid={customInvalid || undefined}
              className={[
                'h-10 w-[88px] rounded-full px-2 text-center text-sm font-medium transition-colors placeholder:text-ink-3 disabled:opacity-35',
                customActive ? 'bg-ink text-white' : 'bg-surface text-ink',
                customInvalid ? 'text-danger shadow-[inset_0_0_0_1px_#c8362b]' : '',
              ].join(' ')}
            />
          </div>
        </div>

        <div>
          <LabelRow label={t.settings.framesPerPage} note={layout ? t.settings.cellMm(layout.cells[0].imageRect.w.toFixed(0), layout.cells[0].imageRect.h.toFixed(0)) : null} />
          <div className="flex flex-wrap gap-2">
            {(Object.keys(GRID_PRESETS) as GridPreset[]).map((k) => (
              <Chip key={k} selected={gridKey === k} onClick={() => setGrid(k)} disabled={busy}>
                {k.replace('x', '×')}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-baseline gap-5 border-t border-rule pt-6" aria-live="polite">
        {settings && layout ? (
          <>
            <div>
              <div className="text-[44px] font-semibold leading-[44px] tracking-[-0.04em] tabular-nums">{settings.frameCount}</div>
              <div className="mt-1.5 text-xs text-ink-2">{t.settings.framesUnit}</div>
            </div>
            <ArrowRight size={20} className="self-center text-[#b5b5b1]" />
            <div>
              <div className="text-[44px] font-semibold leading-[44px] tracking-[-0.04em] tabular-nums">{settings.pageCount}</div>
              <div className="mt-1.5 text-xs text-ink-2">{t.settings.pagesUnit(layout.orientation === 'landscape')}</div>
            </div>
            <div className="ml-auto self-start font-mono text-xs text-ink-3">{settings.projectId}</div>
          </>
        ) : (
          <div className="text-sm text-ink-2">{t.settings.loadVideoFirst}</div>
        )}
      </div>
    </div>
  )
}
