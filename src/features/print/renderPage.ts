import type { Layout, Point } from '../../domain/layout'
import type { ProjectSettings } from '../../domain/settings'
import { CanvasPainter } from './canvasPainter'
import { buildPageSpec, paintPage } from './pagePainter'

export interface RenderPageOptions {
  dpi?: number
  /** Extra white paper around the page, in mm (simulates a scanner bed larger than the page). */
  paddingMm?: number
  /** Rotate the page on the canvas (simulates a crooked scan). */
  rotateDeg?: number
  type?: 'image/png' | 'image/jpeg'
}

export interface RenderedPage {
  blob: Blob
  width: number
  height: number
  /** Where each marker centre ended up on the canvas, in px, in corner order. */
  markerCentersPx: Point[]
  /** Map any page-mm point to canvas px with the same transform. */
  toPx: (p: Point) => Point
}

/**
 * Rasterise a print page to an image, exactly like the PDF but through the
 * Canvas painter. Used for tests and for simulating scans in development.
 */
export async function renderPageToBlob(
  settings: ProjectSettings,
  layout: Layout,
  page: number,
  frames: Map<number, Blob>,
  options: RenderPageOptions = {},
): Promise<RenderedPage> {
  const dpi = options.dpi ?? 300
  const pad = options.paddingMm ?? 0
  const rot = ((options.rotateDeg ?? 0) * Math.PI) / 180
  const pxPerMm = dpi / 25.4
  const pageW = layout.pageSize.w
  const pageH = layout.pageSize.h
  // The canvas holds the rotated page's bounding box, so a 90° turn gives a portrait image like a real flatbed would.
  const width = Math.round((Math.abs(pageW * Math.cos(rot)) + Math.abs(pageH * Math.sin(rot)) + 2 * pad) * pxPerMm)
  const height = Math.round((Math.abs(pageW * Math.sin(rot)) + Math.abs(pageH * Math.cos(rot)) + 2 * pad) * pxPerMm)
  const cx = width / 2
  const cy = height / 2

  const toPx = (p: Point): Point => {
    // Page centred on the canvas, rotated about the canvas centre.
    const x = (p.x - pageW / 2) * pxPerMm
    const y = (p.y - pageH / 2) * pxPerMm
    return { x: cx + x * Math.cos(rot) - y * Math.sin(rot), y: cy + x * Math.sin(rot) + y * Math.cos(rot) }
  }

  const bitmaps = new Map<number, ImageBitmap>()
  for (const [f, blob] of frames) bitmaps.set(f, await createImageBitmap(blob))

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas context unavailable')
  ctx.fillStyle = '#f4f2ee'
  ctx.fillRect(0, 0, width, height)
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.translate((-pageW / 2) * pxPerMm, (-pageH / 2) * pxPerMm)
  const spec = buildPageSpec<CanvasImageSource>(settings, layout, page, (f) => bitmaps.get(f) ?? null)
  paintPage(new CanvasPainter(ctx, pxPerMm), spec)
  for (const b of bitmaps.values()) b.close()

  const blob = await canvas.convertToBlob({ type: options.type ?? 'image/png' })
  return { blob, width, height, markerCentersPx: layout.markers.map((m) => toPx(m.center)), toPx }
}
