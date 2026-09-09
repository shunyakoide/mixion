/**
 * Draws one printed page from a Layout using an abstract Painter, so the
 * on-screen Canvas preview and the pdf-lib output are guaranteed to show the
 * same thing. All coordinates handed to the Painter are millimetres in page
 * space (origin top-left).
 */
import { frameLabel, framesOnPage, framesPerPage } from './frameMap'
import { insetRect, type CellLayout, type Layout, type MarkerLayout, type Point, type Rect } from './layout'
import { markerId, markerModules } from './markers'
import { encodeQrPayload, type ProjectSettings } from './settings'
import { qrModules } from './qrEncode'

export interface Color {
  r: number
  g: number
  b: number
}

const COLORS = {
  black: { r: 0, g: 0, b: 0 },
  white: { r: 1, g: 1, b: 1 },
  ink: { r: 0.2, g: 0.2, b: 0.2 },
  tick: { r: 0.45, g: 0.45, b: 0.45 },
  placeholder: { r: 0.88, g: 0.88, b: 0.88 },
  placeholderText: { r: 0.6, g: 0.6, b: 0.6 },
} as const satisfies Record<string, Color>

export interface Painter<TImage> {
  fillRect(rect: Rect, color: Color): void
  line(from: Point, to: Point, lineWidth: number, color: Color): void
  /** `pos` is the top-left corner of the text's em box. `size` is the em height in mm. */
  text(text: string, pos: Point, size: number, color: Color): void
  /** Draw `image` stretched to `rect` (aspect is already correct by construction). */
  image(image: TImage, rect: Rect): void
}

interface PageFrame<TImage> {
  cell: CellLayout
  frame: number
  label: string
  image: TImage | null
}

export interface PageSpec<TImage> {
  layout: Layout
  page: number
  pageCount: number
  headerText: string
  markers: { marker: MarkerLayout; modules: boolean[][] }[]
  qr: { rect: Rect; modules: boolean[][] }
  frames: PageFrame<TImage>[]
}

const PAGE_STYLE = {
  headerTextSize: 4,
  labelTextSize: 3.5,
  tickLength: 2,
  tickOffset: 0.5,
  tickWidth: 0.2,
} as const

export function headerText(settings: ProjectSettings, page: number, first: number, last: number): string {
  const l = (f: number) => frameLabel(f, settings.frameCount)
  return `Mixion   Page ${page} / ${settings.pageCount}   Frames ${l(first)} - ${l(last)}   ${settings.projectId}   ${settings.fps}fps`
}

/**
 * Everything needed to paint one page. `getImage` may return null to draw a
 * placeholder instead of a frame (used for the print test before video
 * decoding exists).
 */
export function buildPageSpec<TImage>(
  settings: ProjectSettings,
  layout: Layout,
  page: number,
  getImage: (frame: number) => TImage | null,
): PageSpec<TImage> {
  const perPage = framesPerPage(settings.grid)
  const frames = framesOnPage(page, perPage, settings.frameCount)
  if (frames.length === 0) throw new Error(`page ${page} has no frames`)
  return {
    layout,
    page,
    pageCount: settings.pageCount,
    headerText: headerText(settings, page, frames[0], frames[frames.length - 1]),
    markers: layout.markers.map((marker) => ({
      marker,
      modules: markerModules(markerId(page, marker.corner)),
    })),
    qr: { rect: layout.qrRect, modules: qrModules(encodeQrPayload(settings, page)) },
    frames: frames.map((frame, i) => ({
      cell: layout.cells[i],
      frame,
      label: frameLabel(frame, settings.frameCount),
      image: getImage(frame),
    })),
  }
}

/** Paint a module grid into `rect`, merging horizontal runs to keep op counts low. */
export function paintModules<TImage>(painter: Painter<TImage>, modules: boolean[][], rect: Rect, color: Color): void {
  const n = modules.length
  const size = rect.w / n
  for (let r = 0; r < n; r++) {
    const row = modules[r]
    let c = 0
    while (c < n) {
      if (!row[c]) {
        c++
        continue
      }
      let end = c
      while (end < n && row[end]) end++
      painter.fillRect({ x: rect.x + c * size, y: rect.y + r * size, w: (end - c) * size, h: size }, color)
      c = end
    }
  }
}

function paintCropTicks<TImage>(painter: Painter<TImage>, cell: CellLayout): void {
  const { tickLength: len, tickOffset: off, tickWidth: w } = PAGE_STYLE
  const img = cell.imageRect
  const crop = cell.cropRect
  const xs = [crop.x, crop.x + crop.w]
  const ys = [crop.y, crop.y + crop.h]
  // Horizontal ticks outside the left and right image edges, at the crop's top and bottom.
  for (const y of ys) {
    painter.line({ x: img.x - off - len, y }, { x: img.x - off, y }, w, COLORS.tick)
    painter.line({ x: img.x + img.w + off, y }, { x: img.x + img.w + off + len, y }, w, COLORS.tick)
  }
  // Vertical ticks outside the top and bottom image edges, at the crop's left and right.
  for (const x of xs) {
    painter.line({ x, y: img.y - off - len }, { x, y: img.y - off }, w, COLORS.tick)
    painter.line({ x, y: img.y + img.h + off }, { x, y: img.y + img.h + off + len }, w, COLORS.tick)
  }
}

function paintPlaceholder<TImage>(painter: Painter<TImage>, cell: CellLayout, label: string): void {
  const img = cell.imageRect
  painter.fillRect(img, COLORS.placeholder)
  const size = Math.min(img.h * 0.4, img.w * 0.25)
  // Roughly centre the label; painters treat pos as the top-left of the em box.
  const approxWidth = label.length * size * 0.6
  painter.text(label, { x: img.x + (img.w - approxWidth) / 2, y: img.y + (img.h - size) / 2 }, size, COLORS.placeholderText)
}

export function paintPage<TImage>(painter: Painter<TImage>, spec: PageSpec<TImage>): void {
  const { layout } = spec
  painter.fillRect({ x: 0, y: 0, w: layout.pageSize.w, h: layout.pageSize.h }, COLORS.white)

  for (const { marker, modules } of spec.markers) {
    painter.fillRect(marker.clearRect, COLORS.white)
    paintModules(painter, modules, marker.rect, COLORS.black)
  }

  painter.text(spec.headerText, layout.headerTextPos, PAGE_STYLE.headerTextSize, COLORS.ink)

  // One-module quiet zone around the QR, then the modules.
  const qrModuleSize = spec.qr.rect.w / spec.qr.modules.length
  painter.fillRect(insetRect(spec.qr.rect, -qrModuleSize), COLORS.white)
  paintModules(painter, spec.qr.modules, spec.qr.rect, COLORS.black)

  for (const f of spec.frames) {
    if (f.image !== null) painter.image(f.image, f.cell.imageRect)
    else paintPlaceholder(painter, f.cell, f.label)
    paintCropTicks(painter, f.cell)
    painter.text(f.label, f.cell.labelPos, PAGE_STYLE.labelTextSize, COLORS.ink)
  }
}
