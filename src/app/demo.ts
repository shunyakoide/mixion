import { create } from 'zustand'
import { layoutFromSettings } from '../domain/settings'
import { renderPageToBlob } from '../features/print/renderPage'
import { useScanStore } from './scanStore'
import { deriveSettings, useAppStore } from './store'

/**
 * Try the whole flow without a video, a printer, or a scanner:
 * the bundled sample clip stands in for the video, and the printed pages are
 * rendered to images and fed through the real scan pipeline (QR, markers, warp).
 */
interface DemoState {
  running: boolean
  label: string | null
  error: string | null
}

export const useDemoStore = create<DemoState>(() => ({ running: false, label: null, error: null }))

const SAMPLE_URL = `${import.meta.env.BASE_URL}sample.mp4`

/** Load the bundled sample clip as if the user had dropped it. */
export async function loadSampleVideo(): Promise<void> {
  const res = await fetch(SAMPLE_URL)
  if (!res.ok) throw new Error(`サンプル動画を読み込めませんでした (${res.status})`)
  const blob = await res.blob()
  await useAppStore.getState().loadVideo(new File([blob], 'sample.mp4', { type: 'video/mp4' }))
  const { loadError } = useAppStore.getState()
  if (loadError) throw new Error(loadError)
}

/** Render every printed page to an image and import them as scans. Needs a loaded video. */
export async function importPrintedPages(onProgress?: (label: string) => void): Promise<void> {
  const app = useAppStore.getState()
  const settings = deriveSettings(app)
  if (!settings) throw new Error('先に動画を読み込んでください')
  const all = Array.from({ length: settings.frameCount }, (_, i) => i + 1)
  onProgress?.('コマを取り出しています')
  await app.ensureFrames(all)
  const frames = useAppStore.getState().frames
  const layout = layoutFromSettings(settings)
  const files: File[] = []
  for (let page = 1; page <= settings.pageCount; page++) {
    onProgress?.(`印刷ページを画像にしています ${page} / ${settings.pageCount}`)
    // A little rotation and margin so the import has something to correct, like a real scan.
    const r = await renderPageToBlob(settings, layout, page, frames, { dpi: 150, rotateDeg: page % 2 ? 0.8 : -0.6, paddingMm: 6 })
    files.push(new File([r.blob], `sample-page-${String(page).padStart(2, '0')}.png`, { type: 'image/png' }))
  }
  onProgress?.('取り込んで切り出しています')
  await useScanStore.getState().importScans(files)
}

/** One click from the empty start page to a playing animation. */
export async function runDemo(): Promise<void> {
  if (useDemoStore.getState().running) return
  useDemoStore.setState({ running: true, label: 'サンプル動画を読み込んでいます', error: null })
  try {
    await loadSampleVideo()
    await importPrintedPages((label) => useDemoStore.setState({ label }))
    useAppStore.getState().setStep('animate')
    useDemoStore.setState({ running: false, label: null })
  } catch (e) {
    useDemoStore.setState({ running: false, label: null, error: e instanceof Error ? e.message : String(e) })
  }
}

/** Scan-step variant: skip printing, use the current project's pages. */
export async function runScanWithoutPaper(): Promise<void> {
  if (useDemoStore.getState().running) return
  useDemoStore.setState({ running: true, label: '準備しています', error: null })
  try {
    await importPrintedPages((label) => useDemoStore.setState({ label }))
    useDemoStore.setState({ running: false, label: null })
  } catch (e) {
    useDemoStore.setState({ running: false, label: null, error: e instanceof Error ? e.message : String(e) })
  }
}
