import { useEffect, useMemo } from 'react'
import type { ResolvedFrames } from '../../app/scanStore'
import { frameLabel } from '../../domain/frameMap'
import type { ProjectSettings } from '../../domain/settings'
import { useT } from '../../i18n'

const RING = {
  scan: 'ring-transparent',
  original: 'ring-warn',
  hold: 'ring-rule-2',
  blank: 'ring-rule-2',
} as const

interface Props {
  settings: ProjectSettings
  resolved: ResolvedFrames | null
  current: number
  onSelect: (index: number) => void
}

/** Thumbnails of every frame in order. Click one to jump the player to it. */
export function FrameStrip({ settings, resolved, current, onSelect }: Props) {
  const urls = useMemo(() => resolved?.frames.map((b) => URL.createObjectURL(b)) ?? [], [resolved])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  const t = useT()
  if (!resolved) return null
  const counts = resolved.sources.reduce<Record<string, number>>((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {})

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="font-medium">{t.animate.framesTitle}</span>
        <span className="text-ink-2">{t.animate.fromScan(counts.scan ?? 0)}</span>
        {counts.original ? (
          <span className="flex items-center gap-1 text-ink-2">
            <span className="h-2.5 w-2.5 rounded-sm ring-2 ring-warn" aria-hidden /> {t.animate.fromOriginal(counts.original)}
          </span>
        ) : null}
        {(counts.hold ?? 0) + (counts.blank ?? 0) > 0 ? (
          <span className="flex items-center gap-1 text-ink-2">
            <span className="h-2.5 w-2.5 rounded-sm ring-2 ring-rule-2" aria-hidden /> {t.animate.held((counts.hold ?? 0) + (counts.blank ?? 0))}
          </span>
        ) : null}
      </div>
      <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {urls.map((u, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`${frameLabel(i + 1, settings.frameCount)} (${resolved.sources[i]})`}
              aria-current={i === current ? 'true' : undefined}
              className={[
                'relative block w-full overflow-hidden rounded-sm bg-black ring-2 ring-offset-1 ring-offset-paper transition-shadow',
                i === current ? 'ring-accent' : RING[resolved.sources[i]],
              ].join(' ')}
            >
              <img src={u} alt="" className="aspect-video w-full object-cover" loading="lazy" />
              <span className="absolute bottom-0 left-0 rounded-tr-sm bg-ink/70 px-1 text-[10px] leading-4 text-white">{frameLabel(i + 1, settings.frameCount)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
