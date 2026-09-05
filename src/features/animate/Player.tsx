import { useEffect, useMemo, useRef, useState } from 'react'
import type { ResolvedFrames } from '../../app/scanStore'
import { Pause, Play } from '../../components/ui/icons'
import type { ProjectSettings } from '../../domain/settings'

const SOURCE_LABEL = { scan: 'scan', original: 'original', hold: 'hold', blank: 'blank' } as const

export function Player({ settings, resolved }: { settings: ProjectSettings; resolved: ResolvedFrames | null }) {
  const [rawIndex, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const raf = useRef<number | null>(null)
  const urls = useMemo(() => resolved?.frames.map((b) => URL.createObjectURL(b)) ?? [], [resolved])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  const index = urls.length ? rawIndex % urls.length : 0

  useEffect(() => {
    if (!playing || urls.length === 0) return
    let last = performance.now()
    let i = 0
    const step = (t: number) => {
      if (t - last >= 1000 / settings.fps) {
        last = t
        i = (i + 1) % urls.length
        setIndex(i)
      }
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    }
  }, [playing, urls, settings.fps])

  if (!resolved || urls.length === 0) {
    return <div className="flex aspect-video items-center justify-center rounded-lg bg-rule text-sm text-ink-2">Preview</div>
  }

  return (
    <div className="space-y-2">
      <img src={urls[index]} alt={`frame ${index + 1}`} className="aspect-video w-full rounded-lg bg-black object-contain" />
      <div className="flex items-center gap-2 text-xs text-ink-2">
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? '一時停止' : '再生'} className="flex h-8 w-8 items-center justify-center rounded border border-rule-2 hover:border-ink-3">
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <span className="tabular-nums">
          #{index + 1} / {urls.length}
        </span>
        <span>{SOURCE_LABEL[resolved.sources[index]]}</span>
        <span className="ml-auto">{settings.fps} fps</span>
      </div>
    </div>
  )
}
