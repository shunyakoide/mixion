import { useEffect, useMemo, useRef, useState } from 'react'
import type { ResolvedFrames } from '../../app/scanStore'
import { Pause, Play } from '../../components/ui/icons'
import type { ProjectSettings } from '../../domain/settings'
import { useT } from '../../i18n'

const SOURCE_LABEL = { scan: 'scan', original: 'original', hold: 'hold', blank: 'blank' } as const

interface PlayerProps {
  settings: ProjectSettings
  resolved: ResolvedFrames | null
  /** Set by the parent to jump to a frame (0-based) and pause. */
  seek: { index: number; nonce: number } | null
  onFrame?: (index: number) => void
}

export function Player({ settings, resolved, seek, onFrame }: PlayerProps) {
  const [rawIndex, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const t = useT()
  const raf = useRef<number | null>(null)
  const urls = useMemo(() => resolved?.frames.map((b) => URL.createObjectURL(b)) ?? [], [resolved])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  // A seek from the strip wins over the running index until the next tick; derived, not synced.
  const [seenSeek, setSeenSeek] = useState<typeof seek>(null)
  if (seek !== seenSeek) {
    setSeenSeek(seek)
    if (seek) {
      setIndex(seek.index)
      setPlaying(false)
    }
  }
  const index = urls.length ? rawIndex % urls.length : 0
  const indexRef = useRef(index)

  useEffect(() => {
    indexRef.current = index
    onFrame?.(index)
  }, [index, onFrame])

  useEffect(() => {
    if (!playing || urls.length === 0) return
    let last = performance.now()
    let i = indexRef.current
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
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t.animate.pause : t.animate.play} className="flex h-11 w-11 items-center justify-center rounded border border-rule-2 hover:border-ink-3 sm:h-8 sm:w-8">
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
