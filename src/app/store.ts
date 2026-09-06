import { create } from 'zustand'
import { t } from '../i18n'
import { frameTimestamp, framesOnPage, framesPerPage } from '../domain/frameMap'
import { GRID_PRESETS, coerceGridPreset, type GridPreset, type Layout } from '../domain/layout'
import { createProjectSettings, generateProjectId, isValidFps, layoutFromSettings, type ProjectSettings } from '../domain/settings'
import { buildPrintPdf } from '../features/print/buildPdf'
import { saveBlob } from '../lib/files'
import { FrameExtractor, probeVideo, type VideoInfo } from '../lib/video/decode'

export type Step = 'print' | 'scan' | 'animate'
export const STEP_ORDER: readonly Step[] = ['print', 'scan', 'animate']

export type PrintStatus = 'idle' | 'extracting' | 'building' | 'saving' | 'done'

export interface Progress {
  label: string
  done: number
  total: number
}

interface PrintSlice {
  file: File | null
  info: VideoInfo | null
  /** Long-lived decoder for `file`. */
  extractor: FrameExtractor | null
  probing: boolean
  loadError: string | null
  /** True while the bundled sample clip is the source. */
  sample: boolean
  fps: number
  gridKey: GridPreset
  projectId: string
  /** JPEG blobs by 1-based frame number. Cleared when the source or fps changes. */
  frames: Map<number, Blob>
  status: PrintStatus
  progress: Progress | null
  pdfError: string | null
  lastSaved: string | null
}

interface Actions {
  setStep: (step: Step) => void
  loadVideo: (file: File, options?: { sample?: boolean }) => Promise<void>
  clearVideo: () => void
  setFps: (fps: number) => void
  setGrid: (key: GridPreset) => void
  /** Extract any of `frameNumbers` not yet cached. */
  ensureFrames: (frameNumbers: number[]) => Promise<void>
  createPdf: () => Promise<void>
}

export interface AppState extends PrintSlice, Actions {
  step: Step
}

/** Settings derived from the current print inputs, or null until a video is loaded. */
export function deriveSettings(s: Pick<AppState, 'info' | 'fps' | 'gridKey' | 'projectId'>): ProjectSettings | null {
  if (!s.info || !isValidFps(s.fps)) return null
  const dims = { width: s.info.width, height: s.info.height }
  try {
    return createProjectSettings({
      projectId: s.projectId,
      fps: s.fps,
      grid: GRID_PRESETS[coerceGridPreset(s.gridKey, dims)],
      dims,
      duration: s.info.duration,
    })
  } catch {
    return null
  }
}

export function deriveLayout(settings: ProjectSettings | null): Layout | null {
  return settings ? layoutFromSettings(settings) : null
}

export const useAppStore = create<AppState>((set, get) => ({
  step: 'print',
  file: null,
  sample: false,
  info: null,
  extractor: null,
  probing: false,
  loadError: null,
  fps: 8,
  gridKey: '4x3',
  projectId: generateProjectId(),
  frames: new Map(),
  status: 'idle',
  progress: null,
  pdfError: null,
  lastSaved: null,

  setStep: (step) => set({ step }),

  loadVideo: async (file, options) => {
    void get().extractor?.dispose()
    set({ file, sample: options?.sample === true, info: null, extractor: null, probing: true, loadError: null, frames: new Map(), status: 'idle', pdfError: null, lastSaved: null, projectId: generateProjectId() })
    try {
      const info = await probeVideo(file)
      if (get().file !== file) return
      if (!info.canDecodeVideo) {
        set({ probing: false, loadError: t().app.cannotDecode(info.videoCodec ?? null) })
        return
      }
      set({ info, gridKey: coerceGridPreset(get().gridKey, info), probing: false, extractor: new FrameExtractor(file) })
    } catch (e) {
      if (get().file !== file) return
      set({ probing: false, loadError: e instanceof Error ? e.message : String(e) })
    }
  },

  clearVideo: () => {
    void get().extractor?.dispose()
    set({ file: null, sample: false, info: null, extractor: null, probing: false, loadError: null, frames: new Map(), status: 'idle', progress: null, pdfError: null, lastSaved: null })
  },

  setFps: (fps) => {
    if (fps === get().fps) return
    set({ fps, frames: new Map(), status: 'idle', pdfError: null, lastSaved: null })
  },

  setGrid: (gridKey) => set({ gridKey, status: 'idle', pdfError: null, lastSaved: null }),


  ensureFrames: async (frameNumbers) => {
    const { file, fps, frames, extractor } = get()
    if (!file || !extractor) return
    const missing = frameNumbers.filter((f) => !frames.has(f))
    if (missing.length === 0) return
    const extracted = await extractor.extract(missing.map((f) => frameTimestamp(f, fps)))
    // Ignore results if the source changed meanwhile.
    const now = get()
    if (now.file !== file || now.fps !== fps) return
    const next = new Map(now.frames)
    extracted.forEach((e, i) => next.set(missing[i], e.blob))
    set({ frames: next })
  },

  createPdf: async () => {
    const state = get()
    const settings = deriveSettings(state)
    const file = state.file
    const extractor = state.extractor
    if (!settings || !file || !extractor) return
    const all = Array.from({ length: settings.frameCount }, (_, i) => i + 1)
    set({ status: 'extracting', progress: { label: t().app.extractingFrames, done: 0, total: all.length }, pdfError: null, lastSaved: null })
    try {
      const missing = all.filter((f) => !state.frames.has(f))
      if (missing.length > 0) {
        const extracted = await extractor.extract(
          missing.map((f) => frameTimestamp(f, state.fps)),
          { onFrame: (_f, total) => set((s) => ({ progress: { label: t().app.extractingFrames, done: (s.progress?.done ?? 0) + 1, total } })) },
        )
        const next = new Map(get().frames)
        extracted.forEach((e, i) => next.set(missing[i], e.blob))
        set({ frames: next })
      }
      const frames = get().frames
      set({ status: 'building', progress: { label: t().app.buildingPdf, done: 0, total: settings.pageCount } })
      const bytes = await buildPrintPdf({
        settings,
        getFrameImage: async (frame) => {
          const blob = frames.get(frame)
          return blob ? { kind: 'jpeg', bytes: new Uint8Array(await blob.arrayBuffer()) } : null
        },
        onProgress: (done, total) => set({ progress: { label: t().app.buildingPdf, done, total } }),
      })
      set({ status: 'saving', progress: null })
      const filename = `mixion-${settings.projectId}-${settings.fps}fps-${settings.grid.cols}x${settings.grid.rows}.pdf`
      const pdfBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      const result = await saveBlob(new Blob([pdfBuffer], { type: 'application/pdf' }), filename, 'application/pdf')
      set({ status: result === 'cancelled' ? 'idle' : 'done', lastSaved: result === 'cancelled' ? null : filename })
    } catch (e) {
      set({ status: 'idle', progress: null, pdfError: e instanceof Error ? e.message : String(e) })
    }
  },
}))

/** Frame numbers shown on the current preview page. */
export function previewFrameNumbers(settings: ProjectSettings, page: number): number[] {
  return framesOnPage(page, framesPerPage(settings.grid), settings.frameCount)
}

// Dev convenience: inspect and drive the store from the browser console.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __store?: typeof useAppStore }).__store = useAppStore
}
