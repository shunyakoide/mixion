import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResolvedFrames } from '../../app/scanStore'
import { Pause, Play } from '../../components/ui/icons'
import { frameLabel } from '../../domain/frameMap'
import type { ProjectSettings } from '../../domain/settings'
import { useT } from '../../i18n'
import { FrameCache } from '../../lib/frameCache'
import { decodeScaled } from '../../lib/image'

interface PlayerProps {
  settings: ProjectSettings
  resolved: ResolvedFrames | null
  /** Set by the parent to jump to a frame (0-based) and pause. */
  seek: { index: number; nonce: number } | null
  onFrame?: (index: number) => void
}

/** Decoded frames kept ahead of the playhead, in bytes; sets how far ahead we read. */
const AHEAD_BUDGET = 96 * 1024 * 1024
const MIN_AHEAD = 4
const MAX_AHEAD = 64

interface Size {
  w: number
  h: number
}

/**
 * Plays the frames on a canvas. Frames are decoded ahead of time at the size
 * they are shown, so each tick is one `drawImage`; swapping an `<img>` would
 * fetch and decode a full-size JPEG on every frame instead.
 */
export function Player({ settings, resolved, seek, onFrame }: PlayerProps) {
  const t = useT()
  const frames = resolved?.frames ?? null
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cacheRef = useRef<FrameCache<ImageBitmap> | null>(null)
  /** The frame wanted right now; the canvas catches up when it is decoded. */
  const indexRef = useRef(0)
  const [shown, setShown] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [target, setTarget] = useState<Size | null>(null)

  // A seek from the strip pauses and moves the playhead; derived, not synced.
  const [seenSeek, setSeenSeek] = useState<typeof seek>(null)
  if (seek !== seenSeek) {
    setSeenSeek(seek)
    if (seek) setPlaying(false)
  }

  useEffect(() => {
    onFrame?.(shown)
  }, [shown, onFrame])

  /** Draw the wanted frame if it is decoded. */
  const paint = useCallback(() => {
    const cache = cacheRef.current
    const canvas = canvasRef.current
    if (!cache || !canvas) return
    const bitmap = cache.at(indexRef.current)
    if (!bitmap) return
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    setShown(indexRef.current)
  }, [])

  // Decode at the box's device pixels, never larger than the frame itself.
  // The box only exists once there are frames, so `ready` re-runs this when it appears.
  const ready = frames !== null && frames.length > 0
  useEffect(() => {
    const box = boxRef.current
    if (!box || !ready) return
    const { width, height } = settings.dims
    const measure = () => {
      const dpr = window.devicePixelRatio || 1
      const scale = Math.min(1, (box.clientWidth * dpr) / width, (box.clientHeight * dpr) / height)
      const next = { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) }
      setTarget((prev) => (prev && prev.w === next.w && prev.h === next.h ? prev : next))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    // A move to another display changes the pixel ratio without resizing the box.
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [settings.dims, ready])

  useEffect(() => {
    if (!frames || !target) return
    const ahead = Math.round(Math.min(MAX_AHEAD, Math.max(MIN_AHEAD, AHEAD_BUDGET / (target.w * target.h * 4))))
    const cache = new FrameCache<ImageBitmap>(frames.length, (i) => decodeScaled(frames[i], target.w, target.h), {
      ahead,
      parallel: 2,
      onDecoded: (i) => {
        if (i === indexRef.current) paint()
      },
    })
    cacheRef.current = cache
    if (indexRef.current >= frames.length) indexRef.current = 0
    paint()
    return () => {
      cache.dispose()
      cacheRef.current = null
    }
  }, [frames, target, paint])

  useEffect(() => {
    if (!seek) return
    indexRef.current = seek.index
    paint()
  }, [seek, paint])

  useEffect(() => {
    if (!playing || !frames) return
    const n = frames.length
    const start = performance.now()
    const startIndex = indexRef.current
    const period = 1000 / settings.fps
    // The frame is a function of the clock, so the rate stays exact and a slow decode drops a frame instead of delaying everything after it.
    let raf = requestAnimationFrame(function step(now) {
      const i = (startIndex + Math.floor((now - start) / period)) % n
      if (i !== indexRef.current) {
        indexRef.current = i
        paint()
      }
      raf = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(raf)
  }, [playing, frames, settings.fps, paint])

  if (!resolved || !frames || frames.length === 0) {
    return <div className="flex aspect-video items-center justify-center rounded-[20px] bg-surface text-sm text-ink-3">{t.animate.preview}</div>
  }

  const pill = 'flex h-11 items-center rounded-full bg-white/92 text-[13px] text-ink backdrop-blur-[8px]'
  return (
    <div ref={boxRef} className="relative aspect-video w-full overflow-hidden rounded-[20px] bg-ink">
      {target && <canvas ref={canvasRef} width={target.w} height={target.h} role="img" aria-label={t.animate.frameAlt(shown + 1)} className="absolute inset-0 h-full w-full object-contain" />}
      <div className={`${pill} absolute bottom-3 left-3 gap-3 pl-1 pr-4 sm:bottom-4 sm:left-4`}>
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t.animate.pause : t.animate.play} className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-[#2a2a2a]">
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <span className="whitespace-nowrap font-mono tabular-nums">
          {frameLabel(shown + 1, settings.frameCount)} / {frames.length}
        </span>
        {/* The fps is already in the summary next door; on a phone the two pills need the room. */}
        <span className="hidden h-4 w-px bg-rule-3 sm:block" aria-hidden />
        <span className="hidden whitespace-nowrap font-mono sm:inline">{settings.fps} fps</span>
      </div>
      <div className={`${pill} absolute bottom-3 right-3 px-3.5 font-mono text-xs sm:bottom-4 sm:right-4`}>{t.animate.source[resolved.sources[shown]]}</div>
    </div>
  )
}
