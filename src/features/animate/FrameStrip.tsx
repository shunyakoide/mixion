import { memo, useMemo } from 'react'
import type { ResolvedFrames } from '../../app/animateStore'
import { frameLabel } from '../../domain/frameMap'
import type { ProjectSettings } from '../../domain/settings'
import { useT } from '../../i18n'
import { useThumbnails } from './useThumbnails'

type Source = ResolvedFrames['sources'][number]

const RING: Record<Source, string> = {
  scan: '',
  original: 'shadow-[inset_0_0_0_2px_#c98a2b]',
  hold: 'shadow-[inset_0_0_0_2px_#dcdcd8]',
  blank: 'shadow-[inset_0_0_0_2px_#dcdcd8]',
}
const CURRENT = 'shadow-[0_0_0_2px_#fff,0_0_0_4px_#0e0e0e]'

interface Props {
  settings: ProjectSettings
  resolved: ResolvedFrames | null
  current: number
  onSelect: (index: number) => void
}

function Legend({ swatch, children }: { swatch: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-ink-2">
      <span className={`h-2.5 w-2.5 rounded-[2px] ${swatch}`} aria-hidden />
      {children}
    </span>
  )
}

interface ThumbProps {
  index: number
  url: string | null
  label: string
  source: Source
  sourceName: string
  current: boolean
  onSelect: (index: number) => void
}

// Memoised so a tick of the player re-renders the two thumbnails whose ring changed, not all of them.
const Thumb = memo(function Thumb({ index, url, label, source, sourceName, current, onSelect }: ThumbProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(index)}
        aria-label={`${label} (${sourceName})`}
        aria-current={current ? 'true' : undefined}
        className={['relative block w-full overflow-hidden rounded-lg bg-ink transition-shadow', current ? CURRENT : RING[source]].join(' ')}
      >
        {url ? <img src={url} alt="" className="aspect-video w-full object-cover" /> : <div className="aspect-video w-full" />}
        <span className="absolute left-1.5 top-1 font-mono text-[10px] leading-[14px] text-white [text-shadow:0_0_3px_rgba(0,0,0,.8)]">{label}</span>
      </button>
    </li>
  )
})

/** Thumbnails of every frame in order. Click one to jump the player to it. */
export function FrameStrip({ settings, resolved, current, onSelect }: Props) {
  const urls = useThumbnails(resolved?.frames ?? null)
  const t = useT()
  const counts = useMemo(() => {
    const c: Partial<Record<Source, number>> = {}
    for (const s of resolved?.sources ?? []) c[s] = (c[s] ?? 0) + 1
    return c
  }, [resolved])
  if (!resolved) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2 text-[13px]">
        <span className="font-semibold">{t.animate.framesTitle}</span>
        <Legend swatch="bg-ink">{t.animate.fromScan(counts.scan ?? 0)}</Legend>
        {counts.original ? <Legend swatch="bg-white shadow-[inset_0_0_0_2px_#c98a2b]">{t.animate.fromOriginal(counts.original)}</Legend> : null}
        {(counts.hold ?? 0) + (counts.blank ?? 0) > 0 ? <Legend swatch="bg-white shadow-[inset_0_0_0_2px_#dcdcd8]">{t.animate.held((counts.hold ?? 0) + (counts.blank ?? 0))}</Legend> : null}
      </div>
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
        {resolved.frames.map((_, i) => (
          <Thumb
            key={i}
            index={i}
            url={urls[i] ?? null}
            label={frameLabel(i + 1, settings.frameCount)}
            source={resolved.sources[i]}
            sourceName={t.animate.source[resolved.sources[i]]}
            current={i === current}
            onSelect={onSelect}
          />
        ))}
      </ol>
    </div>
  )
}
