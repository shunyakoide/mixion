import { useEffect, useRef, useState } from 'react'
import type { ResolvedFrames } from '../../app/scanStore'
import { Pause, Play } from '../../components/ui/icons'
import { frameLabel } from '../../domain/frameMap'
import type { ProjectSettings } from '../../domain/settings'
import { useT } from '../../i18n'
import { useObjectUrls } from '../../lib/useObjectUrls'

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
  const urls = useObjectUrls(resolved?.frames ?? null)
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
    const step = (now: number) => {
      if (now - last >= 1000 / settings.fps) {
        last = now
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
    return <div className="flex aspect-video items-center justify-center rounded-[20px] bg-surface text-sm text-ink-3">{t.animate.preview}</div>
  }

  const pill = 'flex h-11 items-center rounded-full bg-white/92 text-[13px] text-ink backdrop-blur-[8px]'
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[20px] bg-ink">
      <img src={urls[index]} alt={t.animate.frameAlt(index + 1)} className="absolute inset-0 h-full w-full object-contain" />
      <div className={`${pill} absolute bottom-3 left-3 gap-3 pl-1 pr-4 sm:bottom-4 sm:left-4`}>
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t.animate.pause : t.animate.play} className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-[#2a2a2a]">
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <span className="whitespace-nowrap font-mono tabular-nums">
          {frameLabel(index + 1, settings.frameCount)} / {urls.length}
        </span>
        <span className="h-4 w-px bg-rule-3" aria-hidden />
        <span className="whitespace-nowrap font-mono">{settings.fps} fps</span>
      </div>
      <div className={`${pill} absolute bottom-3 right-3 px-3.5 font-mono text-xs sm:bottom-4 sm:right-4`}>{t.animate.source[resolved.sources[index]]}</div>
    </div>
  )
}
