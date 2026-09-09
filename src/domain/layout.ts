/**
 * Page layout in millimetres. This module is the single source of truth for
 * where everything sits on a printed page: PDF generation, the on-screen
 * preview, and the scan-side slicer all derive their coordinates from here.
 *
 * Origin is the top-left corner of the page, x to the right, y downwards.
 * Pure TypeScript, no DOM dependencies.
 */

export type Paper = 'A4'
export type Orientation = 'landscape' | 'portrait'

export interface Grid {
  /** columns (frames per row) */
  cols: number
  /** rows */
  rows: number
}

/** Pixel dimensions of the source video (used only for aspect ratio). */
export interface Dims {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Size {
  w: number
  h: number
}

/** Corner index: 0 = top-left, 1 = top-right, 2 = bottom-right, 3 = bottom-left. */
export type Corner = 0 | 1 | 2 | 3
export const CORNERS: readonly Corner[] = [0, 1, 2, 3]

export interface MarkerLayout {
  corner: Corner
  /** Black square (the marker pattern itself). */
  rect: Rect
  /** Centre of the marker. This is the point users click on scans. */
  center: Point
  /** Marker plus white quiet zone. Nothing else may be drawn here. */
  clearRect: Rect
}

export interface CellLayout {
  /** 0-based, reading order (left→right, top→bottom). */
  index: number
  /** Whole cell including the label strip below the image. */
  box: Rect
  /** Where the frame image is printed. */
  imageRect: Rect
  /** What ends up in the final video. Inset from imageRect by cropInset. */
  cropRect: Rect
  /** Top-left of the "#NN" label under the image. */
  labelPos: Point
}

export interface Layout {
  paper: Paper
  orientation: Orientation
  grid: Grid
  pageSize: Size
  /** Area available to the grid of cells. */
  contentRect: Rect
  markers: MarkerLayout[]
  /** Header band between the two top markers (page label + QR). */
  headerRect: Rect
  /** Where the page label text starts (left, baseline-ish top). */
  headerTextPos: Point
  qrRect: Rect
  cells: CellLayout[]
}

export interface LayoutInput {
  paper?: Paper
  /** Omit to let chooseOrientation pick the one with the larger frames. */
  orientation?: Orientation
  grid: Grid
  dims: Dims
}

/** All tunables in one place. Values are mm. */
export const LAYOUT_CONSTANTS = {
  /** Distance from paper edge to the marker. Covers printer unprintable
   *  area and scanner edge clipping. */
  outerMargin: 10,
  /** Side of the black marker square. */
  markerSize: 10,
  /** White border required around a marker. */
  markerQuietZone: 2,
  /** Height of the header band (from outerMargin downwards). */
  headerHeight: 18,
  /** Gap between header band / bottom markers and the content area. */
  contentGap: 2,
  /** Side of the QR code. */
  qrSize: 16,
  /** Gap between cells. */
  cellGap: 6,
  /** How far the crop rectangle sits inside the printed image (bleed). */
  cropInset: 1.5,
  /** Strip under each image reserved for the frame number. */
  labelHeight: 5,
  /** Gap between image bottom and the label. */
  labelGap: 1,
} as const

const PAPER_SIZES: Record<Paper, Size> = {
  /** Portrait dimensions. */
  A4: { w: 210, h: 297 },
}

export const GRID_PRESETS = {
  '2x2': { cols: 2, rows: 2 },
  '3x2': { cols: 3, rows: 2 },
  '3x3': { cols: 3, rows: 3 },
  '4x2': { cols: 4, rows: 2 },
  '4x3': { cols: 4, rows: 3 },
} as const satisfies Record<string, Grid>

export type GridPreset = keyof typeof GRID_PRESETS

/**
 * Presets offered for a source. A vertical video gets fewer rows so its tall
 * cells stay large: on portrait paper 3x3, 4x3 and 2x3 all collapse to the
 * same 40x71 mm cell, while 3x2 and 4x2 give 59x105 and 43x76 mm.
 */
export function gridPresetsFor(dims: Dims): GridPreset[] {
  return dims.height > dims.width ? GRID_PRESET_SETS.portrait : GRID_PRESET_SETS.landscape
}

const GRID_PRESET_SETS: Record<Orientation, GridPreset[]> = {
  landscape: ['2x2', '3x3', '4x3'],
  portrait: ['2x2', '3x2', '4x2'],
}

/** The preset set that contains `key`, for showing a consistent row of choices before the source size is known. */
export function gridPresetsAround(key: GridPreset): GridPreset[] {
  return GRID_PRESET_SETS.portrait.includes(key) && !GRID_PRESET_SETS.landscape.includes(key) ? GRID_PRESET_SETS.portrait : GRID_PRESET_SETS.landscape
}

/**
 * The offered preset with the same column count, so a choice made for one
 * orientation carries over when a video of the other orientation is loaded.
 */
export function coerceGridPreset(key: GridPreset, dims: Dims): GridPreset {
  const offered = gridPresetsFor(dims)
  if (offered.includes(key)) return key
  const cols = GRID_PRESETS[key].cols
  return offered.find((k) => GRID_PRESETS[k].cols === cols) ?? offered[offered.length - 1]
}

export function formatGrid(grid: Grid): string {
  return `${grid.cols}x${grid.rows}`
}

export function parseGrid(text: string): Grid | null {
  const m = /^(\d+)x(\d+)$/.exec(text.trim())
  if (!m) return null
  const cols = Number(m[1])
  const rows = Number(m[2])
  if (cols < 1 || rows < 1 || cols > 10 || rows > 10) return null
  return { cols, rows }
}

function pageSizeFor(paper: Paper, orientation: Orientation): Size {
  const p = PAPER_SIZES[paper]
  return orientation === 'portrait' ? { w: p.w, h: p.h } : { w: p.h, h: p.w }
}

/** Largest w×h with the given aspect that fits inside `box`, centred. */
export function fitRect(box: Rect, aspect: number): Rect {
  let w = box.w
  let h = w / aspect
  if (h > box.h) {
    h = box.h
    w = h * aspect
  }
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h }
}

export function insetRect(r: Rect, inset: number): Rect {
  return { x: r.x + inset, y: r.y + inset, w: r.w - 2 * inset, h: r.h - 2 * inset }
}

function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function rectContains(outer: Rect, inner: Rect, eps = 1e-9): boolean {
  return (
    inner.x >= outer.x - eps &&
    inner.y >= outer.y - eps &&
    inner.x + inner.w <= outer.x + outer.w + eps &&
    inner.y + inner.h <= outer.y + outer.h + eps
  )
}

function computeMarkers(pageSize: Size): MarkerLayout[] {
  const { outerMargin: m, markerSize: s, markerQuietZone: q } = LAYOUT_CONSTANTS
  const left = m
  const right = pageSize.w - m - s
  const top = m
  const bottom = pageSize.h - m - s
  const origins: Record<Corner, Point> = {
    0: { x: left, y: top },
    1: { x: right, y: top },
    2: { x: right, y: bottom },
    3: { x: left, y: bottom },
  }
  return CORNERS.map((corner) => {
    const o = origins[corner]
    const rect = { x: o.x, y: o.y, w: s, h: s }
    return { corner, rect, center: rectCenter(rect), clearRect: insetRect(rect, -q) }
  })
}

function computeCells(contentRect: Rect, grid: Grid, aspect: number): CellLayout[] {
  const { cellGap, labelHeight, labelGap, cropInset } = LAYOUT_CONSTANTS
  const cellW = (contentRect.w - cellGap * (grid.cols - 1)) / grid.cols
  const cellH = (contentRect.h - cellGap * (grid.rows - 1)) / grid.rows
  const cells: CellLayout[] = []
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const box: Rect = {
        x: contentRect.x + col * (cellW + cellGap),
        y: contentRect.y + row * (cellH + cellGap),
        w: cellW,
        h: cellH,
      }
      const imageBox: Rect = { x: box.x, y: box.y, w: box.w, h: box.h - labelHeight - labelGap }
      const imageRect = fitRect(imageBox, aspect)
      cells.push({
        index: row * grid.cols + col,
        box,
        imageRect,
        cropRect: insetRect(imageRect, cropInset),
        labelPos: { x: imageRect.x, y: imageRect.y + imageRect.h + labelGap },
      })
    }
  }
  return cells
}

function computeForOrientation(paper: Paper, orientation: Orientation, grid: Grid, dims: Dims): Layout {
  const C = LAYOUT_CONSTANTS
  const pageSize = pageSizeFor(paper, orientation)
  const markers = computeMarkers(pageSize)
  const aspect = dims.width / dims.height

  const headerRect: Rect = {
    x: C.outerMargin,
    y: C.outerMargin,
    w: pageSize.w - 2 * C.outerMargin,
    h: C.headerHeight,
  }
  const contentTop = headerRect.y + headerRect.h + C.contentGap
  const contentBottom = pageSize.h - C.outerMargin - C.markerSize - C.markerQuietZone - C.contentGap
  const contentRect: Rect = {
    x: C.outerMargin,
    y: contentTop,
    w: pageSize.w - 2 * C.outerMargin,
    h: contentBottom - contentTop,
  }

  // QR sits in the header, just left of the top-right marker's quiet zone.
  const trClear = markers[1].clearRect
  const qrRect: Rect = {
    x: trClear.x - C.contentGap - C.qrSize,
    y: headerRect.y + (headerRect.h - C.qrSize) / 2,
    w: C.qrSize,
    h: C.qrSize,
  }
  const tlClear = markers[0].clearRect
  const headerTextPos: Point = { x: tlClear.x + tlClear.w + C.contentGap, y: headerRect.y + 4 }

  return {
    paper,
    orientation,
    grid,
    pageSize,
    contentRect,
    markers,
    headerRect,
    headerTextPos,
    qrRect,
    cells: computeCells(contentRect, grid, aspect),
  }
}

function imageArea(layout: Layout): number {
  const r = layout.cells[0]?.imageRect
  return r ? r.w * r.h : 0
}

/** Pick the orientation that gives the larger printed frame. Ties → landscape. */
export function chooseOrientation(grid: Grid, dims: Dims, paper: Paper = 'A4'): Orientation {
  const landscape = computeForOrientation(paper, 'landscape', grid, dims)
  const portrait = computeForOrientation(paper, 'portrait', grid, dims)
  return imageArea(portrait) > imageArea(landscape) + 1e-9 ? 'portrait' : 'landscape'
}

export function computeLayout(input: LayoutInput): Layout {
  const paper = input.paper ?? 'A4'
  if (!(input.dims.width > 0) || !(input.dims.height > 0)) {
    throw new Error('dims must be positive')
  }
  if (input.grid.cols < 1 || input.grid.rows < 1) {
    throw new Error('grid must have at least 1 column and 1 row')
  }
  const orientation = input.orientation ?? chooseOrientation(input.grid, input.dims, paper)
  return computeForOrientation(paper, orientation, input.grid, input.dims)
}

/** Convert millimetres to pixels at the given DPI. */
export function mmToPx(mm: number, dpi: number): number {
  return (mm / 25.4) * dpi
}


/** Convert millimetres to PDF points (1/72 inch). */
export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72
}
