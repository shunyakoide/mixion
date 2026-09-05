/**
 * Dev-only helpers reachable from the browser console (window.__dev).
 * Not imported in production builds.
 */
import { renderPageToBlob } from '../features/print/renderPage'
import { layoutFromSettings } from '../domain/settings'
import { deriveSettings, useAppStore } from './store'
import { useScanStore } from './scanStore'

/** Mean absolute RGB difference between two image blobs, resized to the first's size. */
async function imageDiff(a: Blob, b: Blob, maxWidth = 480): Promise<{ meanAbs: number; width: number; height: number }> {
  const [ba, bb] = await Promise.all([createImageBitmap(a), createImageBitmap(b)])
  const scale = Math.min(1, maxWidth / ba.width)
  const w = Math.round(ba.width * scale)
  const h = Math.round(ba.height * scale)
  const draw = (bm: ImageBitmap) => {
    const c = new OffscreenCanvas(w, h)
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('ctx')
    ctx.drawImage(bm, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h).data
  }
  const da = draw(ba)
  const db = draw(bb)
  let sum = 0
  for (let i = 0; i < da.length; i += 4) sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
  ba.close()
  bb.close()
  return { meanAbs: sum / (w * h * 3), width: w, height: h }
}

/** Render a print page from the current Print state as if it had been scanned. */
async function simulateScan(page: number, options: { dpi?: number; rotateDeg?: number; paddingMm?: number } = {}) {
  const s = useAppStore.getState()
  const settings = deriveSettings(s)
  if (!settings) throw new Error('load a video first')
  const layout = layoutFromSettings(settings)
  const rendered = await renderPageToBlob(settings, layout, page, s.frames, { dpi: options.dpi ?? 200, rotateDeg: options.rotateDeg ?? 0, paddingMm: options.paddingMm ?? 8 })
  const file = new File([rendered.blob], `sim-page-${String(page).padStart(2, '0')}.png`, { type: 'image/png' })
  return { file, markerCentersPx: rendered.markerCentersPx, width: rendered.width, height: rendered.height }
}

const dev = { renderPageToBlob, imageDiff, simulateScan, appStore: useAppStore, scanStore: useScanStore }
;(window as unknown as { __dev?: typeof dev }).__dev = dev
export type DevTools = typeof dev
