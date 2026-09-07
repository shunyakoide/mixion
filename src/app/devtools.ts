/**
 * Dev-only helpers reachable from the browser console (window.__dev).
 * Not imported in production builds.
 */
import { renderPageToBlob } from '../features/print/renderPage'
import { encodeMp4 } from '../lib/video/encode'
import { encodeGif } from '../lib/video/gif'
import { layoutFromSettings } from '../domain/settings'
import { deriveSettings, useAppStore } from './store'
import { useScanStore } from './scanStore'
import { decodeMarker, detectMarkersBlind, findMarkerNear } from '../features/scan/detectMarkers'
import { bitmapToRgba, loadBitmap } from '../lib/image'
import { readPageQr } from '../features/scan/qrPage'

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

/** Render a print page from the current Print state as if it had been scanned. `hideQr` paints the QR out, like a doodle over it. */
async function simulateScan(page: number, options: { dpi?: number; rotateDeg?: number; paddingMm?: number; hideQr?: boolean } = {}) {
  const s = useAppStore.getState()
  const settings = deriveSettings(s)
  if (!settings) throw new Error('load a video first')
  const layout = layoutFromSettings(settings)
  const rendered = await renderPageToBlob(settings, layout, page, s.frames, { dpi: options.dpi ?? 200, rotateDeg: options.rotateDeg ?? 0, paddingMm: options.paddingMm ?? 8 })
  let blob = rendered.blob
  if (options.hideQr) {
    const bitmap = await createImageBitmap(blob)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('ctx')
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const q = layout.qrRect
    const pts = [{ x: q.x - 2, y: q.y - 2 }, { x: q.x + q.w + 2, y: q.y - 2 }, { x: q.x + q.w + 2, y: q.y + q.h + 2 }, { x: q.x - 2, y: q.y + q.h + 2 }].map(rendered.toPx)
    ctx.fillStyle = '#c04040'
    ctx.beginPath()
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.closePath()
    ctx.fill()
    blob = await canvas.convertToBlob({ type: 'image/png' })
  }
  const file = new File([blob], `sim-page-${String(page).padStart(2, '0')}.png`, { type: 'image/png' })
  return { file, markerCentersPx: rendered.markerCentersPx, width: rendered.width, height: rendered.height }
}

const dev = { renderPageToBlob, imageDiff, simulateScan, deriveSettings, encodeMp4, encodeGif, appStore: useAppStore, scanStore: useScanStore, decodeMarker, detectMarkersBlind, findMarkerNear, bitmapToRgba, loadBitmap, readPageQr, layoutFromSettings }
;(window as unknown as { __dev?: typeof dev }).__dev = dev
export type DevTools = typeof dev
