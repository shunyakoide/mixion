import { create } from 'zustand'
import { t } from '../i18n'
import { framesOnPage, framesPerPage } from '../domain/frameMap'
import { pageToScanHomography, reprojectionError, type Homography } from '../domain/homography'
import type { Corner, Point } from '../domain/layout'
import { layoutFromSettings, sameProject, settingsFromQr, type ProjectSettings, type QrPayload } from '../domain/settings'
import { QR_QUICK_PASSES, QR_THOROUGH_PASSES, readPageQr, type QrReadResult } from '../features/scan/qrPage'
import { detectMarkers, detectMarkersBlind, type BlindDetectResult } from '../domain/scan/detectMarkers'
import { orientationMismatch, quarterTurnsToUpright, rotateQrCorners } from '../domain/scan/orientation'
import { warmUpWarpPool, warpCells } from '../workers/warpPool'
import { bitmapToRgba, compareNames, isImageFile, loadBitmap, rotateBitmap } from '../lib/image'
import { hashBlob } from '../lib/files'
import { splitDuplicateFiles, type SkippedDuplicate } from '../domain/scan/duplicates'
import { extractFrames, probeVideo, type VideoInfo } from '../lib/video/decode'
import { frameTimestamp } from '../domain/frameMap'
import { stopwatch } from '../lib/timing'

type ScanStatus = 'reading' | 'detecting' | 'needs_corners' | 'ready' | 'applying' | 'applied' | 'error'

export interface ScanItem {
  id: string
  file: File
  name: string
  url: string
  width: number
  height: number
  qr: QrPayload | null
  /** Bounding box of the QR in scan px, so a click on it can be told apart from a marker. */
  qrRect: { x: number; y: number; w: number; h: number } | null
  qrNote: string | null
  page: number | null
  pageSource: 'qr' | 'marker' | 'manual' | 'order' | null
  corners: Partial<Record<Corner, Point>>
  /** How the corners were obtained. */
  cornerSource: 'auto' | 'manual' | null
  /** Markers the detector could not find (shown so the user knows what to click). */
  missingCorners: Corner[]
  /** Corners as the detector found them, so a dragged point can be put back. */
  detectedCorners: Partial<Record<Corner, Point>>
  status: ScanStatus
  error: string | null
  /** RMS reprojection error of the last apply, in scan px (0 for 4 exact points). */
  fitError: number | null
  /** Degrees the image was turned clockwise after import so the page reads upright. */
  rotation: number
  /** SHA-256 of the imported file, so the same image is not added twice. Null when it could not be computed. */
  hash: string | null
}

type FrameSource = 'scan' | 'original' | 'hold' | 'blank'

export interface ResolvedFrames {
  frames: Blob[]
  sources: FrameSource[]
}

interface OutputFrame {
  blob: Blob
  source: 'scan' | 'original'
  scanId?: string
}

interface ScanState {
  settings: ProjectSettings | null
  settingsSource: 'qr' | 'manual' | null
  scans: ScanItem[]
  selectedId: string | null
  outputFrames: Map<number, OutputFrame>
  importing: boolean
  importError: string | null
  /** Files of the last import that were not added because the same image was already in the list. */
  skippedDuplicates: SkippedDuplicate[]
  dismissSkipped: () => void
  /** Last export per format (file name), for the step indicator. */
  exported: { mp4: string | null; gif: string | null }
  markExported: (kind: 'mp4' | 'gif', name: string) => void
  /** Optional source video: audio and fallback frames. */
  original: { file: File; info: VideoInfo } | null
  originalLoading: boolean
  originalError: string | null
  /** Frames extracted from the original at the project fps, by frame number. */
  originalFrames: Map<number, Blob>

  loadOriginal: (file: File) => Promise<void>
  clearOriginal: () => void
  /** Final frame list for export/preview, filling gaps from the original or by holding the previous frame. */
  resolveFrames: () => Promise<ResolvedFrames>
  importScans: (files: File[]) => Promise<void>
  removeScan: (id: string) => void
  select: (id: string | null) => void
  setPage: (id: string, page: number | null) => void
  setCorner: (id: string, corner: Corner, point: Point) => void
  resetCorners: (id: string) => void
  /** Put every corner back where the detector found it. */
  restoreDetectedCorners: (id: string) => void
  /** Turn the scan 90° clockwise and detect the markers again. For pages whose QR could not be read. */
  rotateScan: (id: string) => Promise<void>
  /** Run the automatic detection again (QR, orientation, markers), replacing the current corners. */
  redetectScan: (id: string) => Promise<void>
  setManualSettings: (settings: ProjectSettings) => void
  clearSettings: () => void
  /** Forget everything: scans, cut frames, settings, original video. */
  reset: () => void
  /** Drop the imported pages and cut frames to start the import over. Manual settings survive; QR-restored ones come back with the next import. */
  clearScans: () => void
  applyScan: (id: string) => Promise<void>
}

let nextId = 1
/** Bumped by `reset` and `clearScans`, so work started on an earlier set of pages stops writing into the new one. */
let generation = 0
/** Imports run one after another: a drop that lands while a batch is still being read waits for it. */
let importQueue: Promise<void> = Promise.resolve()
/** The original video being probed, so a slower probe cannot overwrite a newer choice. */
let pendingOriginal: File | null = null

function bbox(pts: Point[]): { x: number; y: number; w: number; h: number } {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

function cornersComplete(c: Partial<Record<Corner, Point>>): c is Record<Corner, Point> {
  return c[0] !== undefined && c[1] !== undefined && c[2] !== undefined && c[3] !== undefined
}

interface Prepared {
  file: File
  width: number
  height: number
  qr: QrReadResult
  detected: { corners: Partial<Record<Corner, Point>>; missing: Corner[] } | null
  /** Page number read from the corner markers when the QR could not be. */
  markerPage: number | null
  /** Degrees clockwise the image was turned here. */
  rotation: number
}

const ALL_CORNERS: Corner[] = [0, 1, 2, 3]

/** Lowest page not yet claimed by another scan, for pages whose QR and markers could not be read. */
export function firstUnusedPage(scans: Pick<ScanItem, 'id' | 'page'>[], excludeId: string, pageCount: number): number | null {
  const used = new Set(scans.filter((x) => x.id !== excludeId && x.page !== null).map((x) => x.page))
  for (let p = 1; p <= pageCount; p++) if (!used.has(p)) return p
  return null
}

/**
 * Read the QR, turn the image upright when it was scanned sideways, and find the corner markers.
 * `forceTurns` applies a manual rotation instead of the automatic one. Without a readable QR the
 * markers themselves say which way the page is turned and which page it is.
 *
 * The QR is read on a downscaled copy first; the slow full-resolution pass only runs when nothing
 * else can tell us about the page (no settings yet, or no marker decoded either). `quickQr` hands
 * over a downscaled read that was already made while looking for the project settings.
 */
async function prepareScan(file: File, settings: ProjectSettings | null, options: { forceTurns?: number; autoRotate: boolean; quickQr?: QrReadResult }): Promise<Prepared> {
  const lap = stopwatch(`prepare ${file.name}`)
  let bitmap = await loadBitmap(file)
  lap('decode')
  let qr: QrReadResult = options.quickQr ?? readPageQr(bitmap, QR_QUICK_PASSES)
  lap(options.quickQr ? 'qr cached' : 'qr quick')
  let thorough = false
  const readThorough = (current: QrReadResult): QrReadResult => {
    if (current.ok || thorough) return current
    thorough = true
    const r = readPageQr(bitmap, QR_THOROUGH_PASSES, current.tried)
    lap('qr thorough')
    return r
  }
  const layoutFor = () => (settings ? layoutFromSettings(settings) : qr.ok ? layoutFromSettings(settingsFromQr(qr.payload)) : null)
  // Without settings the QR is the only way to learn the layout, so it is worth the slow pass.
  if (!layoutFor()) qr = readThorough(qr)
  const layout = layoutFor()

  let rotation = 0
  let outFile = file
  const turn = async (k: number) => {
    const kk = ((k % 4) + 4) % 4
    if (kk === 0) return
    const size = { width: bitmap.width, height: bitmap.height }
    const rotated = await rotateBitmap(bitmap, kk)
    bitmap.close()
    bitmap = await loadBitmap(rotated.blob)
    outFile = new File([rotated.blob], file.name, { type: rotated.blob.type })
    rotation = (rotation + kk * 90) % 360
    lap(`turn ${kk}`)
    // Carry the QR over by geometry: a second jsQR pass on the re-encoded image can fail and would lose a good read.
    if (qr.ok) qr = { ...qr, corners: rotateQrCorners(qr.corners, kk, size) }
  }
  const autoTurns = options.forceTurns === undefined && options.autoRotate
  if (options.forceTurns !== undefined) await turn(options.forceTurns)
  else if (autoTurns && qr.ok) await turn(quarterTurnsToUpright(qr.corners))
  else if (autoTurns && layout && orientationMismatch(bitmap, layout.pageSize)) await turn(1)

  let detected: Prepared['detected'] = null
  let markerPage: number | null = null
  if (layout) {
    try {
      let blind: BlindDetectResult | null = null
      if (!qr.ok) {
        blind = detectMarkersBlind(bitmapToRgba(bitmap), layout)
        lap('blind')
        if (blind.decoded === 0) {
          // Neither the quick QR pass nor the markers read anything: last resort, the full-resolution QR.
          qr = readThorough(qr)
          if (qr.ok && autoTurns) await turn(quarterTurnsToUpright(qr.corners))
        }
      }
      if (qr.ok) {
        const r = detectMarkers(bitmapToRgba(bitmap), layout, qr.corners)
        lap('detect')
        detected = { corners: r.corners, missing: ALL_CORNERS.filter((c) => !r.found.includes(c)) }
      } else if (blind) {
        let r = blind
        if (r.turns !== 0 && options.forceTurns === undefined) {
          await turn(r.turns)
          r = detectMarkersBlind(bitmapToRgba(bitmap), layout)
          lap('blind again')
        }
        markerPage = r.page
        if (r.found.length > 0) detected = { corners: r.corners, missing: ALL_CORNERS.filter((c) => !r.found.includes(c)) }
      }
    } catch {
      detected = null
    }
  }
  const { width, height } = bitmap
  bitmap.close()
  return { file: outFile, width, height, qr, detected, markerPage, rotation }
}

function statusFor(item: ScanItem): ScanStatus {
  if (item.status === 'applied' || item.status === 'applying' || item.status === 'reading' || item.status === 'detecting') return item.status
  if (item.error) return 'error'
  return cornersComplete(item.corners) && item.page !== null ? 'ready' : 'needs_corners'
}

export const useScanStore = create<ScanState>((set, get) => ({
  settings: null,
  settingsSource: null,
  scans: [],
  selectedId: null,
  outputFrames: new Map(),
  importing: false,
  importError: null,
  skippedDuplicates: [],
  dismissSkipped: () => set({ skippedDuplicates: [] }),
  exported: { mp4: null, gif: null },
  markExported: (kind, name) => set((s) => ({ exported: { ...s.exported, [kind]: name } })),
  original: null,
  originalLoading: false,
  originalError: null,
  originalFrames: new Map(),

  loadOriginal: async (file) => {
    pendingOriginal = file
    set({ originalLoading: true, originalError: null, original: null, originalFrames: new Map() })
    try {
      const info = await probeVideo(file)
      if (pendingOriginal !== file) return
      set({ original: { file, info }, originalLoading: false })
    } catch (e) {
      if (pendingOriginal !== file) return
      set({ originalLoading: false, originalError: e instanceof Error ? e.message : String(e) })
    }
  },

  clearOriginal: () => {
    pendingOriginal = null
    set({ original: null, originalError: null, originalFrames: new Map() })
  },

  resolveFrames: async () => {
    const { settings, outputFrames, original } = get()
    if (!settings) throw new Error(t().scan.errNoSettings)
    const n = settings.frameCount
    const missing: number[] = []
    for (let f = 1; f <= n; f++) if (!outputFrames.has(f)) missing.push(f)

    let originalFrames = get().originalFrames
    if (original && missing.length > 0) {
      const need = missing.filter((f) => !originalFrames.has(f))
      if (need.length > 0) {
        const extracted = await extractFrames(original.file, need.map((f) => frameTimestamp(f, settings.fps)))
        originalFrames = new Map(originalFrames)
        extracted.forEach((e, i) => originalFrames.set(need[i], e.blob))
        // Keep the cache only if it is still the same video; the frames are right for this call either way.
        if (get().original === original) set({ originalFrames })
      }
    }

    const frames: Blob[] = []
    const sources: FrameSource[] = []
    let blank: Blob | null = null
    for (let f = 1; f <= n; f++) {
      const out = outputFrames.get(f)
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

  importScans: (files) => {
    const turn = importQueue.then(() => importBatch(files))
    importQueue = turn.catch(() => undefined)
    return turn
  },

  removeScan: (id) => {
    const item = get().scans.find((x) => x.id === id)
    if (item) URL.revokeObjectURL(item.url)
    const wasInUse = [...get().outputFrames.values()].some((f) => f.scanId === id)
    set((s) => {
      const outputFrames = new Map([...s.outputFrames].filter(([, f]) => f.scanId !== id))
      const scans = s.scans.filter((x) => x.id !== id)
      return { scans, outputFrames, selectedId: s.selectedId === id ? (scans[0]?.id ?? null) : s.selectedId }
    })
    // Its frames were cut over another scan of the same page: bring that one's back.
    if (item && wasInUse && item.page !== null) {
      const other = get().scans.findLast((x) => x.page === item.page && x.status === 'applied')
      if (other) void get().applyScan(other.id)
    }
  },

  select: (id) => set({ selectedId: id }),

  setPage: (id, page) =>
    set((s) => ({
      scans: s.scans.map((x) => (x.id === id ? statusUpdate({ ...x, page, pageSource: 'manual', status: x.status === 'applied' ? 'needs_corners' : x.status }) : x)),
    })),

  setCorner: (id, corner, point) =>
    set((s) => ({
      scans: s.scans.map((x) =>
        x.id === id ? statusUpdate({ ...x, corners: { ...x.corners, [corner]: point }, cornerSource: 'manual', missingCorners: x.missingCorners.filter((c) => c !== corner), status: x.status === 'applied' ? 'needs_corners' : x.status, error: null }) : x,
      ),
    })),

  resetCorners: (id) =>
    set((s) => ({
      scans: s.scans.map((x) => (x.id === id ? statusUpdate({ ...x, corners: {}, cornerSource: null, missingCorners: [], status: 'needs_corners', error: null, fitError: null }) : x)),
    })),

  restoreDetectedCorners: (id) =>
    set((s) => ({
      scans: s.scans.map((x) => {
        if (x.id !== id) return x
        const corners = { ...x.detectedCorners }
        const missing = ([0, 1, 2, 3] as Corner[]).filter((c) => corners[c] === undefined)
        return statusUpdate({ ...x, corners, cornerSource: 'auto', missingCorners: missing, status: x.status === 'applied' ? 'needs_corners' : x.status, error: null })
      }),
    })),

  rotateScan: (id) => reanalyze(id, { forceTurns: 1, autoRotate: false }),

  redetectScan: (id) => reanalyze(id, { autoRotate: true }),

  setManualSettings: (settings) => set({ settings, settingsSource: 'manual' }),

  clearSettings: () => set({ settings: null, settingsSource: null }),

  clearScans: () => {
    generation++
    for (const item of get().scans) URL.revokeObjectURL(item.url)
    set((s) => ({
      scans: [],
      selectedId: null,
      outputFrames: new Map(),
      importing: false,
      importError: null,
      skippedDuplicates: [],
      exported: { mp4: null, gif: null },
      settings: s.settingsSource === 'manual' ? s.settings : null,
      settingsSource: s.settingsSource === 'manual' ? 'manual' : null,
    }))
  },

  reset: () => {
    generation++
    pendingOriginal = null
    for (const item of get().scans) URL.revokeObjectURL(item.url)
    set({
      settings: null,
      settingsSource: null,
      scans: [],
      selectedId: null,
      outputFrames: new Map(),
      importing: false,
      importError: null,
      skippedDuplicates: [],
      exported: { mp4: null, gif: null },
      original: null,
      originalLoading: false,
      originalError: null,
      originalFrames: new Map(),
    })
  },

  applyScan: async (id) => {
    const { settings } = get()
    const item = get().scans.find((x) => x.id === id)
    if (!settings || !item || !cornersComplete(item.corners) || item.page === null) return
    const page = item.page
    const layout = layoutFromSettings(settings)
    let h: Homography
    try {
      h = pageToScanHomography(layout, item.corners)
    } catch (e) {
      set((s) => ({ scans: s.scans.map((x) => (x.id === id ? { ...x, status: 'error', error: t().scan.errBadCorners(e instanceof Error ? e.message : String(e)) } : x)) }))
      return
    }
    const fitError = reprojectionError(
      h,
      layout.markers.map((m) => m.center),
      layout.markers.map((m) => item.corners[m.corner] as Point),
    )
    set((s) => ({ scans: s.scans.map((x) => (x.id === id ? { ...x, status: 'applying', error: null } : x)) }))
    try {
      const lap = stopwatch(`apply ${item.name}`)
      const bitmap = await loadBitmap(item.file)
      const rgba = bitmapToRgba(bitmap)
      bitmap.close()
      lap('decode')
      const frames = framesOnPage(page, framesPerPage(settings.grid), settings.frameCount)
      const outWidth = settings.dims.width - (settings.dims.width % 2)
      const outHeight = settings.dims.height - (settings.dims.height % 2)
      const jobs = frames.map((_, i) => ({ cropRect: layout.cells[i].cropRect, outWidth, outHeight }))
      const blobs = await warpCells(rgba, h, jobs)
      lap(`warp ${jobs.length}`)
      set((s) => {
        // Removed while its cells were being cut: the frames went with it.
        if (!s.scans.some((x) => x.id === id)) return {}
        const outputFrames = new Map(s.outputFrames)
        // Drop frames previously produced by this scan (page may have changed).
        for (const [f, o] of outputFrames) if (o.scanId === id) outputFrames.delete(f)
        frames.forEach((f, i) => outputFrames.set(f, { blob: blobs[i], source: 'scan', scanId: id }))
        return { outputFrames, scans: s.scans.map((x) => (x.id === id ? { ...x, status: 'applied', fitError } : x)) }
      })
    } catch (e) {
      set((s) => ({ scans: s.scans.map((x) => (x.id === id ? { ...x, status: 'error', error: e instanceof Error ? e.message : String(e) } : x)) }))
    }
  },
}))

/** One import: hash, read the QR, find the markers and cut every page that comes out complete. */
async function importBatch(files: File[]): Promise<void> {
  const { set, get } = { set: useScanStore.setState, get: useScanStore.getState }
  const images = files.filter(isImageFile).sort((a, b) => compareNames(a.name, b.name))
  if (images.length === 0) {
    set({ importError: t().scan.errChooseImages })
    return
  }
  set({ importing: true, importError: null, skippedDuplicates: [] })
  const gen = generation
  /** Whether the page is still in the list; `reset`, `clearScans` and `removeScan` can take it out while it is being read. */
  const listed = (id: string) => generation === gen && get().scans.some((x) => x.id === id)
  // The same file added twice brings nothing; drop it and say so. Hashing is quick next to decoding.
  const hashed = await Promise.all(images.map(async (file) => ({ file, hash: await hashBlob(file).catch(() => null) })))
  const existing = new Map<string, string>()
  for (const x of get().scans) if (x.hash) existing.set(x.hash, x.name)
  const { fresh, skipped } = splitDuplicateFiles(hashed, existing)
  set({ skippedDuplicates: skipped })
  if (fresh.length === 0) {
    set({ importing: false })
    return
  }
  const hashOf = new Map(hashed.map((h) => [h.file, h.hash]))
  warmUpWarpPool()
  const items = fresh.map((file): ScanItem => ({
    id: `scan-${nextId++}`,
    file,
    name: file.name,
    url: URL.createObjectURL(file),
    width: 0,
    height: 0,
    qr: null,
    qrRect: null,
    qrNote: null,
    page: null,
    pageSource: null,
    corners: {},
    cornerSource: null,
    missingCorners: [],
    detectedCorners: {},
    status: 'reading',
    error: null,
    fitError: null,
    rotation: 0,
    hash: hashOf.get(file) ?? null,
  }))
  set((s) => ({ scans: [...s.scans, ...items], selectedId: s.selectedId ?? items[0].id }))
  // Find the project settings before analysing anything, so pages ahead of the first readable QR get a layout too.
  const quickQr = new Map<File, QrReadResult>()
  if (!get().settings) {
    const lap = stopwatch('settings pass')
    for (const file of fresh) {
      try {
        const bitmap = await loadBitmap(file)
        if (generation !== gen) {
          bitmap.close()
          return
        }
        const qr = readPageQr(bitmap, QR_QUICK_PASSES)
        bitmap.close()
        lap(file.name)
        quickQr.set(file, qr)
        if (qr.ok) {
          set({ settings: settingsFromQr(qr.payload), settingsSource: 'qr' })
          break
        }
      } catch {
        // The page itself reports the problem when it is analysed below.
      }
    }
  }
  for (const item of items) {
    const { id, file } = item
    if (generation !== gen) return
    if (!listed(id)) continue
    try {
      set((s) => ({ scans: s.scans.map((x) => (x.id === id ? { ...x, status: 'detecting' } : x)) }))
      const { file: scanFile, width, height, qr, detected, markerPage, rotation } = await prepareScan(file, get().settings, { autoRotate: true, quickQr: quickQr.get(file) })
      // Removed while it was being read: its URL is already revoked and nothing must be written back.
      if (!listed(id)) continue
      const url = scanFile === file ? item.url : URL.createObjectURL(scanFile)
      if (url !== item.url) URL.revokeObjectURL(item.url)
      set((s) => {
        let settings = s.settings
        let settingsSource = s.settingsSource
        let qrNote: string | null = qr.ok ? null : qr.error
        let page: number | null = null
        let pageSource: ScanItem['pageSource'] = null
        if (qr.ok) {
          const first = s.scans.find((x) => x.qr)?.qr
          if (first && !sameProject(first, qr.payload)) {
            qrNote = t().scan.errOtherProject(qr.payload.p)
          } else {
            if (!settings || settingsSource !== 'qr') {
              settings = settingsFromQr(qr.payload)
              settingsSource = 'qr'
            }
            page = qr.payload.pg
            pageSource = 'qr'
          }
        }
        if (page === null && markerPage !== null && settings && markerPage <= settings.pageCount) {
          page = markerPage
          pageSource = 'marker'
        }
        if (page === null && settings) {
          // Fall back to import order for pages without a readable QR.
          page = firstUnusedPage(s.scans, id, settings.pageCount)
          if (page !== null) pageSource = 'order'
        }
        const corners = detected?.corners ?? {}
        const scans = s.scans.map((x) =>
          x.id === id
            ? statusUpdate({
                ...x,
                file: scanFile,
                url,
                width,
                height,
                rotation,
                qr: qr.ok ? qr.payload : null,
                qrRect: qr.ok ? bbox([qr.corners.topLeft, qr.corners.topRight, qr.corners.bottomRight, qr.corners.bottomLeft]) : null,
                qrNote,
                page,
                pageSource,
                corners,
                cornerSource: detected ? 'auto' : null,
                missingCorners: detected?.missing ?? [],
                detectedCorners: detected?.corners ?? {},
                status: 'needs_corners',
              })
            : x,
        )
        return { scans, settings, settingsSource }
      })
      // Everything found: cut the page out right away.
      const after = get().scans.find((x) => x.id === id)
      if (after && after.status === 'ready') await get().applyScan(id)
    } catch (e) {
      set((s) => ({
        scans: s.scans.map((x) => (x.id === id ? { ...x, status: 'error', error: e instanceof Error ? e.message : String(e) } : x)),
      }))
    }
  }
  if (generation !== gen) return
  // Pages read before any QR fixed the settings had no layout to work with; give them one now.
  if (get().settings) {
    for (const x of get().scans) {
      if (x.page === null && x.status !== 'applied' && x.status !== 'applying' && x.status !== 'error') await reanalyze(x.id, { autoRotate: true })
    }
  }
  set({ importing: false })
}

function statusUpdate(item: ScanItem): ScanItem {
  return { ...item, status: statusFor(item) }
}

/** Run `prepareScan` again on an imported page and take over its image, corners and page number. */
async function reanalyze(id: string, options: { forceTurns?: number; autoRotate: boolean }): Promise<void> {
  const { set, get } = { set: useScanStore.setState, get: useScanStore.getState }
  const item = get().scans.find((x) => x.id === id)
  if (!item || item.status === 'reading' || item.status === 'detecting' || item.status === 'applying') return
  set((s) => ({ scans: s.scans.map((x) => (x.id === id ? { ...x, status: 'detecting', error: null } : x)) }))
  try {
    const { file, width, height, qr, detected, markerPage, rotation } = await prepareScan(item.file, get().settings, options)
    // Removed meanwhile: its URL is already revoked and nothing must be written back.
    if (!get().scans.some((x) => x.id === id)) return
    const url = file === item.file ? item.url : URL.createObjectURL(file)
    if (url !== item.url) URL.revokeObjectURL(item.url)
    set((s) => ({
      scans: s.scans.map((x) => {
        if (x.id !== id) return x
        const fromQr = qr.ok && s.settings && qr.payload.p === s.settings.projectId ? qr.payload.pg : null
        let page = fromQr ?? (x.pageSource === 'manual' ? x.page : (markerPage ?? x.page))
        let pageSource: ScanItem['pageSource'] = fromQr !== null ? 'qr' : x.pageSource === 'manual' ? 'manual' : markerPage !== null ? 'marker' : x.pageSource
        if (page === null && s.settings) {
          page = firstUnusedPage(s.scans, id, s.settings.pageCount)
          if (page !== null) pageSource = 'order'
        }
        return statusUpdate({
          ...x,
          file,
          url,
          width,
          height,
          rotation: (x.rotation + rotation) % 360,
          qrRect: qr.ok ? bbox([qr.corners.topLeft, qr.corners.topRight, qr.corners.bottomRight, qr.corners.bottomLeft]) : null,
          page,
          pageSource,
          corners: detected?.corners ?? {},
          cornerSource: detected ? 'auto' : null,
          missingCorners: detected?.missing ?? [],
          detectedCorners: detected?.corners ?? {},
          status: 'needs_corners',
          fitError: null,
        })
      }),
    }))
    const after = get().scans.find((x) => x.id === id)
    if (after && after.status === 'ready') await get().applyScan(id)
  } catch (e) {
    set((s) => ({ scans: s.scans.map((x) => (x.id === id ? { ...x, status: 'error', error: e instanceof Error ? e.message : String(e) } : x)) }))
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __scanStore?: typeof useScanStore }).__scanStore = useScanStore
}
