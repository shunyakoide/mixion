import { create } from 'zustand'
import { describeError } from '../i18n'
import type { ProjectSettings } from '../domain/settings'
import { anySignal } from '../lib/abort'
import { FrameExtractor, probeVideo, type VideoInfo } from '../lib/video/decode'
import { extractMissing } from '../lib/video/extractMissing'

export type FrameSource = 'scan' | 'original' | 'hold' | 'blank'

export interface ResolvedFrames {
  frames: Blob[]
  sources: FrameSource[]
}

interface AnimateState {
  /** Optional source video: audio and fallback frames. Kept even when this browser cannot decode its video, for the audio. */
  original: { file: File; info: VideoInfo } | null
  originalLoading: boolean
  originalError: string | null
  /** Frames taken from the original at the project fps, by frame number. */
  originalFrames: Map<number, Blob>
  /** How far the frames for the current resolve have been taken from the original; null when nothing is being taken. */
  filling: { done: number; total: number } | null
  /** Last export per format (file name), for the step indicator. */
  exported: { mp4: string | null; gif: string | null }

  loadOriginal: (file: File) => Promise<void>
  clearOriginal: () => void
  /**
   * Final frame list for playback and export: the cut frames, gaps filled from
   * the original or by holding the previous frame. Taking frames from the
   * original is the slow part; `signal` stops it, and so do `clearOriginal`,
   * a new original and `reset`.
   */
  resolveFrames: (settings: ProjectSettings, cut: ReadonlyMap<number, { blob: Blob }>, options?: { signal?: AbortSignal }) => Promise<ResolvedFrames>
  markExported: (kind: 'mp4' | 'gif', name: string) => void
  /** The cut frames are gone, so what was exported from them no longer counts. */
  forgetExports: () => void
  /** Drop the original video, its frames and the export record. */
  reset: () => void
}

/** The original being probed, so a slower probe cannot overwrite a newer choice. */
let pendingOriginal: File | null = null
/** Long-lived decoder for the original, so each resolve does not reopen the file. */
let extractor: FrameExtractor | null = null
/** The frames being taken from the original right now. */
let fill: AbortController | null = null

function dropOriginalWork(): void {
  fill?.abort()
  fill = null
  pendingOriginal = null
  const old = extractor
  extractor = null
  void old?.dispose()
}

export const useAnimateStore = create<AnimateState>((set, get) => ({
  original: null,
  originalLoading: false,
  originalError: null,
  originalFrames: new Map(),
  filling: null,
  exported: { mp4: null, gif: null },

  loadOriginal: async (file) => {
    dropOriginalWork()
    pendingOriginal = file
    set({ originalLoading: true, originalError: null, original: null, originalFrames: new Map(), filling: null })
    try {
      const info = await probeVideo(file)
      if (pendingOriginal !== file) return
      // Without a decoder the frames come from the scans alone; the audio track is copied, not decoded.
      if (info.canDecodeVideo) extractor = new FrameExtractor(file)
      set({ original: { file, info }, originalLoading: false })
    } catch (e) {
      if (pendingOriginal !== file) return
      set({ originalLoading: false, originalError: describeError(e) })
    }
  },

  clearOriginal: () => {
    dropOriginalWork()
    set({ original: null, originalLoading: false, originalError: null, originalFrames: new Map(), filling: null })
  },

  resolveFrames: async (settings, cut, options = {}) => {
    const n = settings.frameCount
    const missing: number[] = []
    for (let f = 1; f <= n; f++) if (!cut.has(f)) missing.push(f)

    const { original } = get()
    let originalFrames = get().originalFrames
    if (original && extractor && missing.some((f) => !originalFrames.has(f))) {
      // A newer resolve supersedes the fill of an older one.
      fill?.abort()
      const own = new AbortController()
      fill = own
      const signal = options.signal ? anySignal([options.signal, own.signal]) : own.signal
      try {
        const got = await extractMissing(extractor, settings.fps, originalFrames, missing, {
          signal,
          onProgress: (done, total) => set({ filling: { done, total } }),
          // Cached as they come, so a fill stopped halfway is not repeated from the start. Only for the same video.
          onFrame: (f, blob) => {
            if (get().original === original) set((s) => ({ originalFrames: new Map(s.originalFrames).set(f, blob) }))
          },
        })
        originalFrames = new Map(get().originalFrames)
        for (const [f, blob] of got) originalFrames.set(f, blob)
        if (get().original === original) set({ originalFrames })
      } finally {
        if (fill === own) {
          fill = null
          set({ filling: null })
        }
      }
    }

    const frames: Blob[] = []
    const sources: FrameSource[] = []
    let blank: Blob | null = null
    for (let f = 1; f <= n; f++) {
      const out = cut.get(f)
      if (out) {
        frames.push(out.blob)
        sources.push('scan')
        continue
      }
      const orig = original ? originalFrames.get(f) : undefined
      if (orig) {
        frames.push(orig)
        sources.push('original')
        continue
      }
      if (frames.length > 0) {
        frames.push(frames[frames.length - 1])
        sources.push('hold')
        continue
      }
      if (!blank) {
        const c = new OffscreenCanvas(settings.dims.width, settings.dims.height)
        const ctx = c.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, c.width, c.height)
        }
        blank = await c.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
      }
      frames.push(blank)
      sources.push('blank')
    }
    return { frames, sources }
  },

  markExported: (kind, name) => set((s) => ({ exported: { ...s.exported, [kind]: name } })),

  forgetExports: () => set({ exported: { mp4: null, gif: null } }),

  reset: () => {
    dropOriginalWork()
    set({ original: null, originalLoading: false, originalError: null, originalFrames: new Map(), filling: null, exported: { mp4: null, gif: null } })
  },
}))
