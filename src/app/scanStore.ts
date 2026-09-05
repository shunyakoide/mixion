import { create } from 'zustand'
import { framesOnPage, framesPerPage } from '../domain/frameMap'
import { pageToScanHomography, reprojectionError, type Homography } from '../domain/homography'
import type { Corner, Point } from '../domain/layout'
import { layoutFromSettings, sameProject, settingsFromQr, type ProjectSettings, type QrPayload } from '../domain/settings'
import { readPageQr } from '../features/scan/qrPage'
import { warpCells } from '../features/scan/warpClient'
import { bitmapToRgba, compareNames, isImageFile, loadBitmap, rgbaToBlob } from '../lib/image'

export type ScanStatus = 'reading' | 'needs_corners' | 'ready' | 'applying' | 'applied' | 'error'

export interface ScanItem {
  id: string
  file: File
  name: string
  url: string
  width: number
  height: number
  qr: QrPayload | null
  qrNote: string | null
  page: number | null
  pageSource: 'qr' | 'manual' | 'order' | null
  corners: Partial<Record<Corner, Point>>
  status: ScanStatus
  error: string | null
  /** RMS reprojection error of the last apply, in scan px (0 for 4 exact points). */
  fitError: number | null
}

export interface OutputFrame {
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

  importScans: (files: File[]) => Promise<void>
  removeScan: (id: string) => void
  select: (id: string | null) => void
  setPage: (id: string, page: number | null) => void
  setCorner: (id: string, corner: Corner, point: Point) => void
  resetCorners: (id: string) => void
  setManualSettings: (settings: ProjectSettings) => void
  clearSettings: () => void
  applyScan: (id: string) => Promise<void>
}

let nextId = 1

function cornersComplete(c: Partial<Record<Corner, Point>>): c is Record<Corner, Point> {
  return c[0] !== undefined && c[1] !== undefined && c[2] !== undefined && c[3] !== undefined
}

function statusFor(item: ScanItem): ScanStatus {
  if (item.status === 'applied' || item.status === 'applying' || item.status === 'reading') return item.status
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

  importScans: async (files) => {
    const images = files.filter(isImageFile).sort((a, b) => compareNames(a.name, b.name))
    if (images.length === 0) {
      set({ importError: '画像ファイル（JPEG / PNG）を選んでください' })
      return
    }
    set({ importing: true, importError: null })
    for (const file of images) {
      const id = `scan-${nextId++}`
      const item: ScanItem = {
        id,
        file,
        name: file.name,
        url: URL.createObjectURL(file),
        width: 0,
        height: 0,
        qr: null,
        qrNote: null,
        page: null,
        pageSource: null,
        corners: {},
        status: 'reading',
        error: null,
        fitError: null,
      }
      set((s) => ({ scans: [...s.scans, item], selectedId: s.selectedId ?? id }))
      try {
        const bitmap = await loadBitmap(file)
        const { width, height } = bitmap
        const qr = readPageQr(bitmap)
        bitmap.close()
        set((s) => {
          let settings = s.settings
          let settingsSource = s.settingsSource
          let qrNote: string | null = qr.ok ? null : qr.error
          let page: number | null = null
          let pageSource: ScanItem['pageSource'] = null
          if (qr.ok) {
            const first = s.scans.find((x) => x.qr)?.qr
            if (first && !sameProject(first, qr.payload)) {
              qrNote = `別のプロジェクト (${qr.payload.p}) のページです`
            } else {
              if (!settings || settingsSource !== 'qr') {
                settings = settingsFromQr(qr.payload)
                settingsSource = 'qr'
              }
              page = qr.payload.pg
              pageSource = 'qr'
            }
          }
          if (page === null && settings) {
            // Fall back to import order for pages without a readable QR.
            const used = new Set(s.scans.filter((x) => x.id !== id && x.page !== null).map((x) => x.page))
            for (let p = 1; p <= settings.pageCount; p++) {
              if (!used.has(p)) {
                page = p
                pageSource = 'order'
                break
              }
            }
          }
          const scans = s.scans.map((x) =>
            x.id === id
              ? statusUpdate({ ...x, width, height, qr: qr.ok ? qr.payload : null, qrNote, page, pageSource, status: 'needs_corners' })
              : x,
          )
          return { scans, settings, settingsSource }
        })
      } catch (e) {
        set((s) => ({
          scans: s.scans.map((x) => (x.id === id ? { ...x, status: 'error', error: e instanceof Error ? e.message : String(e) } : x)),
        }))
      }
    }
    set({ importing: false })
  },

  removeScan: (id) => {
    const item = get().scans.find((x) => x.id === id)
    if (item) URL.revokeObjectURL(item.url)
    set((s) => {
      const outputFrames = new Map([...s.outputFrames].filter(([, f]) => f.scanId !== id))
      const scans = s.scans.filter((x) => x.id !== id)
      return { scans, outputFrames, selectedId: s.selectedId === id ? (scans[0]?.id ?? null) : s.selectedId }
    })
  },

  select: (id) => set({ selectedId: id }),

  setPage: (id, page) =>
    set((s) => ({
      scans: s.scans.map((x) => (x.id === id ? statusUpdate({ ...x, page, pageSource: 'manual', status: x.status === 'applied' ? 'needs_corners' : x.status }) : x)),
    })),

  setCorner: (id, corner, point) =>
    set((s) => ({
      scans: s.scans.map((x) =>
        x.id === id ? statusUpdate({ ...x, corners: { ...x.corners, [corner]: point }, status: x.status === 'applied' ? 'needs_corners' : x.status, error: null }) : x,
      ),
    })),

  resetCorners: (id) =>
    set((s) => ({
      scans: s.scans.map((x) => (x.id === id ? statusUpdate({ ...x, corners: {}, status: 'needs_corners', error: null, fitError: null }) : x)),
    })),

  setManualSettings: (settings) => set({ settings, settingsSource: 'manual' }),

  clearSettings: () => set({ settings: null, settingsSource: null }),

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
      set((s) => ({ scans: s.scans.map((x) => (x.id === id ? { ...x, status: 'error', error: `四隅の位置が不正です (${e instanceof Error ? e.message : e})` } : x)) }))
      return
    }
    const fitError = reprojectionError(
      h,
      layout.markers.map((m) => m.center),
      layout.markers.map((m) => item.corners[m.corner] as Point),
    )
    set((s) => ({ scans: s.scans.map((x) => (x.id === id ? { ...x, status: 'applying', error: null } : x)) }))
    try {
      const bitmap = await loadBitmap(item.file)
      const rgba = bitmapToRgba(bitmap)
      bitmap.close()
      const frames = framesOnPage(page, framesPerPage(settings.grid), settings.frameCount)
      const outWidth = settings.dims.width - (settings.dims.width % 2)
      const outHeight = settings.dims.height - (settings.dims.height % 2)
      const jobs = frames.map((_, i) => ({ cropRect: layout.cells[i].cropRect, outWidth, outHeight }))
      const results = await warpCells(rgba, h, jobs)
      const blobs = await Promise.all(results.map((r) => rgbaToBlob(r)))
      set((s) => {
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

function statusUpdate(item: ScanItem): ScanItem {
  return { ...item, status: statusFor(item) }
}

if (import.meta.env.DEV) {
  ;(window as unknown as { __scanStore?: typeof useScanStore }).__scanStore = useScanStore
}
