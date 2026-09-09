import { create } from 'zustand'
import { describeError, t } from '../i18n'
import { frameTimestamp, framesOnPage, framesPerPage } from '../domain/frameMap'
import { GRID_PRESETS, coerceGridPreset, type GridPreset, type Layout } from '../domain/layout'
import { createProjectSettings, generateProjectId, isValidFps, layoutFromSettings, settingsProblem, type ProjectSettings, type SettingsProblem } from '../domain/settings'
import { buildPrintPdf } from '../lib/print/buildPdf'
import { renderPageToBlob } from '../lib/print/renderPage'
import { saveAsZip, saveBlob } from '../lib/files'
import { FrameExtractor, probeVideo, type VideoInfo } from '../lib/video/decode'

export type Step = 'print' | 'scan' | 'animate'
export const STEP_ORDER: readonly Step[] = ['print', 'scan', 'animate']

type PrintStatus = 'idle' | 'extracting' | 'building' | 'saving' | 'done'

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
  /** Why the last preview extraction failed, shown on the page instead of the spinner. */
  frameError: string | null
  status: PrintStatus
  progress: Progress | null
  pdfError: string | null
  /** Name of the PDF or zip that was last saved. */
  lastSaved: string | null
  savedKind: 'pdf' | 'png' | null
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
  /** Save a zip with one 300 dpi PNG per page instead of the PDF, for drawing in an app. */
  createPngPages: () => Promise<void>
}

export interface AppState extends PrintSlice, Actions {
  step: Step
}

/** Settings derived from the current print inputs, or null until a video is loaded. */
/** Why the loaded video cannot be printed with the current fps and grid; null when it can or when nothing is loaded. */
export function deriveProblem(s: Pick<AppState, 'info' | 'fps' | 'gridKey'>): SettingsProblem | null {
  if (!s.info || !isValidFps(s.fps)) return null
  const dims = { width: s.info.width, height: s.info.height }
  return settingsProblem({ fps: s.fps, grid: GRID_PRESETS[coerceGridPreset(s.gridKey, dims)], duration: s.info.duration })
}

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
  frameError: null,
  status: 'idle',
  progress: null,
  pdfError: null,
  lastSaved: null,
  savedKind: null,

  setStep: (step) => set({ step }),

  loadVideo: async (file, options) => {
    void get().extractor?.dispose()
    set({ file, sample: options?.sample === true, info: null, extractor: null, probing: true, loadError: null, frames: new Map(), frameError: null, status: 'idle', pdfError: null, lastSaved: null, savedKind: null, projectId: generateProjectId() })
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
      set({ probing: false, loadError: describeError(e) })
    }
  },

  clearVideo: () => {
    void get().extractor?.dispose()
    set({ file: null, sample: false, info: null, extractor: null, probing: false, loadError: null, frames: new Map(), frameError: null, status: 'idle', progress: null, pdfError: null, lastSaved: null, savedKind: null })
  },

  setFps: (fps) => {
    if (fps === get().fps) return
    set({ fps, frames: new Map(), frameError: null, status: 'idle', pdfError: null, lastSaved: null, savedKind: null })
  },

  setGrid: (gridKey) => set({ gridKey, status: 'idle', pdfError: null, lastSaved: null, savedKind: null }),


  ensureFrames: async (frameNumbers) => {
    const { file, fps, frames, extractor } = get()
    if (!file || !extractor) return
    const missing = frameNumbers.filter((f) => !frames.has(f))
    if (missing.length === 0) return
    let extracted
    try {
      extracted = await extractor.extract(missing.map((f) => frameTimestamp(f, fps)))
    } catch (e) {
      const now = get()
      if (now.file === file && now.fps === fps) set({ frameError: describeError(e) })
      return
    }
    // Ignore results if the source changed meanwhile.
    const now = get()
    if (now.file !== file || now.fps !== fps) return
    const next = new Map(now.frames)
    extracted.forEach((e, i) => next.set(missing[i], e.blob))
    set({ frames: next, frameError: null })
  },

  createPdf: async () => {
    const state = get()
    const settings = deriveSettings(state)
    if (!settings || !state.file || !state.extractor) return
    try {
      const frames = await extractAllFrames(settings)
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
      const filename = `${baseName(settings)}.pdf`
      const pdfBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      const result = await saveBlob(new Blob([pdfBuffer], { type: 'application/pdf' }), filename, 'application/pdf')
      if (result === 'cancelled') set({ status: 'idle', lastSaved: null, savedKind: null })
      else set({ status: 'done', lastSaved: filename, savedKind: 'pdf' })
    } catch (e) {
      set({ status: 'idle', progress: null, pdfError: describeError(e) })
    }
  },

  createPngPages: async () => {
    const state = get()
    const settings = deriveSettings(state)
    if (!settings || !state.file || !state.extractor) return
    try {
      const frames = await extractAllFrames(settings)
      const layout = layoutFromSettings(settings)
      const perPage = framesPerPage(settings.grid)
      const base = baseName(settings)
      const pad = String(settings.pageCount).length
      const files = []
      set({ status: 'building', progress: { label: t().app.renderingPages, done: 0, total: settings.pageCount } })
      for (let page = 1; page <= settings.pageCount; page++) {
        // Only hand the renderer the frames on this page; it decodes every blob it is given.
        const onPage = new Map<number, Blob>()
        for (const f of framesOnPage(page, perPage, settings.frameCount)) {
          const blob = frames.get(f)
          if (blob) onPage.set(f, blob)
        }
        const rendered = await renderPageToBlob(settings, layout, page, onPage, { dpi: PNG_PAGE_DPI, type: 'image/png' })
        files.push({ name: `${base}-p${String(page).padStart(pad, '0')}.png`, blob: rendered.blob })
        set({ progress: { label: t().app.renderingPages, done: page, total: settings.pageCount } })
      }
      set({ status: 'saving', progress: null })
      const zipName = `${base}-png.zip`
      const result = await saveAsZip(files, zipName)
      if (result === 'cancelled') set({ status: 'idle', lastSaved: null, savedKind: null })
      else set({ status: 'done', lastSaved: zipName, savedKind: 'png' })
    } catch (e) {
      set({ status: 'idle', progress: null, pdfError: describeError(e) })
    }
  },
}))

/** Resolution of the PNG pages: the same 300 dpi that is recommended for scans. */
export const PNG_PAGE_DPI = 300

function baseName(settings: ProjectSettings): string {
  return `mixion-${settings.projectId}-${settings.fps}fps-${settings.grid.cols}x${settings.grid.rows}`
}

/**
 * Make sure every frame of the project is decoded, reporting progress on the
 * store, and return the complete frame map. Shared by the PDF and PNG saves.
 */
async function extractAllFrames(settings: ProjectSettings): Promise<Map<number, Blob>> {
  const state = useAppStore.getState()
  const { extractor, fps } = state
  if (!extractor) throw new Error('no video loaded')
  const all = Array.from({ length: settings.frameCount }, (_, i) => i + 1)
  const set = useAppStore.setState
  set({ status: 'extracting', progress: { label: t().app.extractingFrames, done: 0, total: all.length }, pdfError: null, lastSaved: null, savedKind: null })
  const missing = all.filter((f) => !state.frames.has(f))
  if (missing.length > 0) {
    const extracted = await extractor.extract(
      missing.map((f) => frameTimestamp(f, fps)),
      { onFrame: (_f, total) => set((s) => ({ progress: { label: t().app.extractingFrames, done: (s.progress?.done ?? 0) + 1, total } })) },
    )
    const next = new Map(useAppStore.getState().frames)
    extracted.forEach((e, i) => next.set(missing[i], e.blob))
    set({ frames: next })
  }
  return useAppStore.getState().frames
}

/** Frame numbers shown on the current preview page. */
export function previewFrameNumbers(settings: ProjectSettings, page: number): number[] {
  return framesOnPage(page, framesPerPage(settings.grid), settings.frameCount)
}

// Dev convenience: inspect and drive the store from the browser console.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __store?: typeof useAppStore }).__store = useAppStore
}
