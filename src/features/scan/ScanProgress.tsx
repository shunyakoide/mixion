import { useScanStore } from '../../app/scanStore'
import { frameRangeOnPage, framesOnPage, framesPerPage } from '../../domain/frameMap'
import { frameLabel } from '../../domain/frameMap'
import type { ProjectSettings } from '../../domain/settings'
import { useT } from '../../i18n'

/** One-line progress for the Scan step: how many frames are cut, and which pages are still missing. */
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
    <div className="space-y-2 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{t.scan.progressTitle}</span>
        <span className="tabular-nums text-ink-2">
          {done} / {settings.frameCount}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-rule" role="progressbar" aria-valuenow={done} aria-valuemax={settings.frameCount}>
        <div className="h-full bg-ok transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {missingPages.length > 0 ? (
        <ul className="space-y-1 text-ink-2">
          {missingPages.map((m) => (
            <li key={m.page}>
              {t.scan.missingPage(m.page, frameLabel(m.range[0], settings.frameCount), frameLabel(m.range[1], settings.frameCount))}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ok">{t.scan.allCut}</p>
      )}
    </div>
  )
}
