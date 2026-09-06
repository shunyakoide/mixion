import { useScanStore } from '../../app/scanStore'
import { frameRangeOnPage, framesOnPage, framesPerPage } from '../../domain/frameMap'
import { frameLabel } from '../../domain/frameMap'
import type { ProjectSettings } from '../../domain/settings'
import { useT } from '../../i18n'

/** Progress for the Scan step: how many frames are cut, and which pages are still missing. */
export function ScanProgress({ settings }: { settings: ProjectSettings }) {
  const outputFrames = useScanStore((s) => s.outputFrames)
  const t = useT()
  const perPage = framesPerPage(settings.grid)
  const done = outputFrames.size
  const missingPages: { page: number; range: [number, number] }[] = []
  for (let p = 1; p <= settings.pageCount; p++) {
    const frames = framesOnPage(p, perPage, settings.frameCount)
    if (frames.some((f) => !outputFrames.has(f))) {
      const r = frameRangeOnPage(p, perPage, settings.frameCount)
      if (r) missingPages.push({ page: p, range: r })
    }
  }
  const pct = Math.round((100 * done) / Math.max(1, settings.frameCount))
  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="whitespace-nowrap text-[13px] font-semibold">{t.scan.progressTitle}</span>
        <span className="whitespace-nowrap text-2xl font-semibold tracking-[-0.03em] tabular-nums">
          {done}
          <span className="text-[13px] font-medium text-ink-3"> / {settings.frameCount}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-rule-2" role="progressbar" aria-valuenow={done} aria-valuemax={settings.frameCount}>
        <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {missingPages.length > 0 ? (
        <div className="text-[13px] text-ink-2">
          <div className="mb-1.5 text-xs text-ink-3">{t.scan.missingPages}</div>
          <ul className="flex flex-col gap-1.5">
            {missingPages.map((m) => (
              <li key={m.page} className="flex justify-between whitespace-nowrap">
                <span>P{m.page}</span>
                <span className="font-mono">
                  {frameLabel(m.range[0], settings.frameCount)}–{frameLabel(m.range[1], settings.frameCount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[13px] text-ink-2">{t.scan.allCut}</p>
      )}
    </div>
  )
}
