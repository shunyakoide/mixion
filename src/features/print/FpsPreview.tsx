import { useEffect, useMemo } from 'react'
import { useAppStore } from '../../app/store'
import type { ProjectSettings } from '../../domain/settings'
import { Player } from '../shared/Player'
import { useT } from '../../i18n'

/** Frames asked for at once; small so playback starts early and a stale run after an fps change is short. */
const CHUNK = 12

/** The clip played back at the chosen fps, from the same frames the pages and the PDF use. */
export function FpsPreview({ settings }: { settings: ProjectSettings }) {
  const frames = useAppStore((s) => s.frames)
  const frameError = useAppStore((s) => s.frameError)
  const ensureFrames = useAppStore((s) => s.ensureFrames)
  const t = useT()
  const { fps, frameCount, projectId } = settings

  useEffect(() => {
    let stop = false
    void (async () => {
      for (let first = 1; first <= frameCount && !stop; first += CHUNK) {
        await ensureFrames(Array.from({ length: Math.min(CHUNK, frameCount - first + 1) }, (_, i) => first + i))
      }
    })()
    return () => {
      stop = true
    }
  }, [fps, frameCount, projectId, ensureFrames])

  // Play the frames from the first up to the first one still missing; the loop grows as they arrive.
  const resolved = useMemo(() => {
    const out: Blob[] = []
    for (let f = 1; f <= frameCount; f++) {
      const blob = frames.get(f)
      if (!blob) break
      out.push(blob)
    }
    return { frames: out }
  }, [frames, frameCount])
  const loaded = resolved.frames.length
  const autoPlay = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  return (
    <div className="rounded-3xl bg-surface p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold tracking-[0.02em]">{t.print.motionPreview}</span>
        <span className="font-mono text-xs text-ink-2" aria-live="polite">
          {loaded < frameCount ? t.print.motionLoading(loaded, frameCount) : t.print.motionMeta(frameCount, fps, (frameCount / fps).toFixed(1))}
        </span>
      </div>
      {/* Capped so a 16:9 box stays under ~280px tall and the pages below stay in view. */}
      <div className="mx-auto max-w-[500px]">
        {loaded > 0 ? (
          <Player settings={settings} resolved={resolved} autoPlay={autoPlay} />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-[20px] bg-rule-3 px-4 text-center text-xs">
            {frameError ? (
              <span className="rounded-full bg-danger px-3 py-1 text-white">{frameError}</span>
            ) : (
              <span className="flex items-center gap-2 text-ink-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink-3/40 border-t-ink-2" aria-hidden />
                {t.print.loadingFrames}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
