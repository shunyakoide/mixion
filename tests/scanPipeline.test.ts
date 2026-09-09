/**
 * The printed page, scanned and read back, end to end and without a
 * browser: a page is painted from the real layout, QR and marker modules,
 * "scanned" with rotation, margin and ink spread, and then fed through the
 * same pure steps the app runs: QR read → settings → marker detection →
 * homography → warp. Each cut cell must come back as the flat colour that
 * was printed in it. A real inkjet scan sits beside the synthetic pages.
 *
 * Change the QR payload, the read passes or the marker detector, and this
 * is the test that says whether a page still reads.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { decode as decodeJpeg } from 'jpeg-js'
import { describe, expect, it } from 'vitest'
import { applyHomography, pageToScanHomography, type Homography } from '../src/domain/homography'
import { CORNERS, GRID_PRESETS, type Corner, type Layout, type Point, type Rect } from '../src/domain/layout'
import { cornersConsistent } from '../src/domain/scan/cornerGeometry'
import { detectMarkers, detectMarkersBlind, type QrCornersPx } from '../src/domain/scan/detectMarkers'
import { quarterTurnsToUpright, rotatePoint, rotateQrCorners } from '../src/domain/scan/orientation'
import { QR_ALL_PASSES, QR_QUICK_PASSES, readQrFromRgba, type QrPass } from '../src/domain/scan/qrRead'
import type { RgbaImage } from '../src/domain/scan/rgba'
import { warpCell } from '../src/domain/scan/warp'
import { MAX_PAGES, createProjectSettings, encodeQrPayload, layoutFromSettings, settingsFromQr, type ProjectSettings } from '../src/domain/settings'
import { buildPageSpec, paintPage, type Color, type Painter } from '../src/features/print/pagePainter'
import { qrModules } from '../src/lib/qr'

// ---------------------------------------------------------------- painting

/** Paints a page into RGBA pixels at `pxPerMm`. Frames are flat colours; text is not drawn. */
class RasterPainter implements Painter<Color> {
  readonly pixels: RgbaImage
  private readonly pxPerMm: number

  constructor(widthMm: number, heightMm: number, pxPerMm: number) {
    this.pxPerMm = pxPerMm
    const w = Math.round(widthMm * pxPerMm)
    const h = Math.round(heightMm * pxPerMm)
    this.pixels = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }
  }

  fillRect(rect: Rect, color: Color): void {
    const { width, height, data } = this.pixels
    const x0 = Math.max(0, Math.round(rect.x * this.pxPerMm))
    const y0 = Math.max(0, Math.round(rect.y * this.pxPerMm))
    const x1 = Math.min(width, Math.round((rect.x + rect.w) * this.pxPerMm))
    const y1 = Math.min(height, Math.round((rect.y + rect.h) * this.pxPerMm))
    const r = Math.round(color.r * 255)
    const g = Math.round(color.g * 255)
    const b = Math.round(color.b * 255)
    for (let y = y0; y < y1; y++) {
      for (let x = x0, i = (y * width + x0) * 4; x < x1; x++, i += 4) {
        data[i] = r
        data[i + 1] = g
        data[i + 2] = b
        data[i + 3] = 255
      }
    }
  }

  /** Crop ticks are axis-aligned, so a line is a thin rectangle. */
  line(from: Point, to: Point, lineWidth: number, color: Color): void {
    const half = lineWidth / 2
    this.fillRect({ x: Math.min(from.x, to.x) - half, y: Math.min(from.y, to.y) - half, w: Math.abs(to.x - from.x) + lineWidth, h: Math.abs(to.y - from.y) + lineWidth }, color)
  }

  text(): void {
    // The header and labels do not matter to the reader, and there is no font here.
  }

  image(color: Color, rect: Rect): void {
    this.fillRect(rect, color)
  }
}

/** A distinct, saturated colour for frame `f`, so a cell cut from the wrong place shows. */
function frameColor(f: number): Color {
  const hue = ((f * 47) % 360) / 60
  const x = 1 - Math.abs((hue % 2) - 1)
  const [r, g, b] = hue < 1 ? [1, x, 0] : hue < 2 ? [x, 1, 0] : hue < 3 ? [0, 1, x] : hue < 4 ? [0, x, 1] : hue < 5 ? [x, 0, 1] : [1, 0, x]
  return { r: 0.15 + 0.7 * r, g: 0.15 + 0.7 * g, b: 0.15 + 0.7 * b }
}

function paintPrintedPage(settings: ProjectSettings, layout: Layout, page: number, pxPerMm: number, options: { hideQr?: boolean } = {}): RgbaImage {
  const painter = new RasterPainter(layout.pageSize.w, layout.pageSize.h, pxPerMm)
  paintPage(painter, buildPageSpec<Color>(settings, layout, page, frameColor))
  // A doodle over the code, as happens: the reader then has only the markers.
  if (options.hideQr) painter.fillRect({ x: layout.qrRect.x - 3, y: layout.qrRect.y - 3, w: layout.qrRect.w + 6, h: layout.qrRect.h + 6 }, { r: 0.75, g: 0.25, b: 0.25 })
  return painter.pixels
}

// ---------------------------------------------------------------- scanning

/** Grow every dark feature by one pixel on each side (a 3×3 minimum): what ink does on paper. */
function spreadInk(img: RgbaImage): RgbaImage {
  const { width: w, height: h, data: d } = img
  const out = new Uint8ClampedArray(d.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      let r = 255
      let g = 255
      let b = 255
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          const i = (yy * w + xx) * 4
          if (d[i] + d[i + 1] + d[i + 2] < r + g + b) {
            r = d[i]
            g = d[i + 1]
            b = d[i + 2]
          }
        }
      }
      out[o] = r
      out[o + 1] = g
      out[o + 2] = b
      out[o + 3] = 255
    }
  }
  return { width: w, height: h, data: out }
}

interface ScanOptions {
  /** Scan resolution. */
  dpi: number
  /** Page turned clockwise on the bed, degrees. */
  rotateDeg?: number
  /** Scanner bed beyond the page, mm on every side. */
  paddingMm?: number
}

interface Scanned {
  image: RgbaImage
  /** Page mm to scan px, the ground truth the detector is measured against. */
  toPx: (p: Point) => Point
}

/**
 * Photograph the painted page the way renderPageToBlob does: centred on a
 * bed, turned by `rotateDeg`, sampled bilinearly at the scan resolution.
 */
function scanPage(painted: RgbaImage, paintPxPerMm: number, layout: Layout, options: ScanOptions): Scanned {
  const pxPerMm = options.dpi / 25.4
  const pad = options.paddingMm ?? 0
  const rot = ((options.rotateDeg ?? 0) * Math.PI) / 180
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const pageW = layout.pageSize.w
  const pageH = layout.pageSize.h
  const width = Math.round((Math.abs(pageW * cos) + Math.abs(pageH * sin) + 2 * pad) * pxPerMm)
  const height = Math.round((Math.abs(pageW * sin) + Math.abs(pageH * cos) + 2 * pad) * pxPerMm)
  const cx = width / 2
  const cy = height / 2
  const toPx = (p: Point): Point => {
    const x = (p.x - pageW / 2) * pxPerMm
    const y = (p.y - pageH / 2) * pxPerMm
    return { x: cx + x * cos - y * sin, y: cy + x * sin + y * cos }
  }
  const data = new Uint8ClampedArray(width * height * 4)
  const sd = painted.data
  const sw = painted.width
  const sh = painted.height
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Pixel centre back to page mm, then to the painted page's pixel grid.
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const mx = (dx * cos + dy * sin) / pxPerMm + pageW / 2
      const my = (-dx * sin + dy * cos) / pxPerMm + pageH / 2
      const o = (y * width + x) * 4
      const fx = mx * paintPxPerMm - 0.5
      const fy = my * paintPxPerMm - 0.5
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) {
        // Off the page: the scanner lid.
        data[o] = data[o + 1] = data[o + 2] = 205
        data[o + 3] = 255
        continue
      }
      const tx = fx - x0
      const ty = fy - y0
      const i00 = (y0 * sw + x0) * 4
      const i10 = i00 + 4
      const i01 = i00 + sw * 4
      const i11 = i01 + 4
      for (let c = 0; c < 3; c++) {
        data[o + c] = sd[i00 + c] * (1 - tx) * (1 - ty) + sd[i10 + c] * tx * (1 - ty) + sd[i01 + c] * (1 - tx) * ty + sd[i11 + c] * tx * ty
      }
      data[o + 3] = 255
    }
  }
  return { image: { width, height, data }, toPx }
}

/** Turn an image `k` quarter turns clockwise, matching `rotatePoint`. */
function rotateRgba(img: RgbaImage, k: number): RgbaImage {
  let out = img
  for (let n = 0; n < ((k % 4) + 4) % 4; n++) {
    const { width: w, height: h, data: d } = out
    const data = new Uint8ClampedArray(d.length)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // (x, y) lands at (h - 1 - y, x) in an image h wide.
        const o = (x * h + (h - 1 - y)) * 4
        const i = (y * w + x) * 4
        data[o] = d[i]
        data[o + 1] = d[i + 1]
        data[o + 2] = d[i + 2]
        data[o + 3] = 255
      }
    }
    out = { width: h, height: w, data }
  }
  return out
}

// ---------------------------------------------------------------- reading

/** Mean colour of the middle 60% of a cut, so a slightly soft edge does not count. */
function meanInner(img: RgbaImage): Color {
  const x0 = Math.floor(img.width * 0.2)
  const x1 = Math.ceil(img.width * 0.8)
  const y0 = Math.floor(img.height * 0.2)
  const y1 = Math.ceil(img.height * 0.8)
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4
      r += img.data[i]
      g += img.data[i + 1]
      b += img.data[i + 2]
      n++
    }
  }
  return { r: r / n / 255, g: g / n / 255, b: b / n / 255 }
}

function expectColor(actual: Color, expected: Color, tolerance = 0.06): void {
  expect(Math.abs(actual.r - expected.r)).toBeLessThan(tolerance)
  expect(Math.abs(actual.g - expected.g)).toBeLessThan(tolerance)
  expect(Math.abs(actual.b - expected.b)).toBeLessThan(tolerance)
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * The app's path from a scan to cut frames, minus the store: read the QR,
 * rebuild the settings from it, find the markers next to where the QR says
 * they are, solve the homography and cut every cell.
 */
function cutPage(scan: RgbaImage, passes: QrPass[] = QR_ALL_PASSES) {
  const qr = readQrFromRgba(scan, passes)
  if (!qr.ok) throw new Error(`QR not read: ${qr.failure.kind}`)
  const settings = settingsFromQr(qr.payload)
  const layout = layoutFromSettings(settings)
  const detected = detectMarkers(scan, layout, qr.corners)
  if (detected.found.length !== 4) throw new Error(`markers found: ${detected.found.join(',')}`)
  const corners = detected.corners as Record<Corner, Point>
  const h = pageToScanHomography(layout, corners)
  const cells = layout.cells.map((cell) => warpCell(scan, h, { cropRect: cell.cropRect, outWidth: 96, outHeight: 54 }))
  return { qr, settings, layout, corners, h, cells }
}

const settings = createProjectSettings({ projectId: 'k7Qz', fps: 8, grid: GRID_PRESETS['4x3'], dims: { width: 1920, height: 1080 }, duration: 5 })
const layout = layoutFromSettings(settings)
const PAINT_PX_PER_MM = 300 / 25.4

describe('a painted page, scanned and read back', () => {
  const page = 3
  const painted = paintPrintedPage(settings, layout, page, PAINT_PX_PER_MM)
  const frames = layout.cells.map((_, i) => page * 12 - 11 + i)

  it.each([
    { name: 'flat on the bed at 300 dpi', dpi: 300, rotateDeg: 0, paddingMm: 0 },
    { name: 'turned 3° with a margin at 300 dpi', dpi: 300, rotateDeg: 3, paddingMm: 8 },
    { name: 'turned -2.5° at 200 dpi', dpi: 200, rotateDeg: -2.5, paddingMm: 5 },
    { name: 'a phone-sized 150 dpi capture', dpi: 150, rotateDeg: 1.5, paddingMm: 10 },
  ])('$name: QR → settings → markers → homography → every cell', ({ dpi, rotateDeg, paddingMm }) => {
    const scan = scanPage(painted, PAINT_PX_PER_MM, layout, { dpi, rotateDeg, paddingMm })
    const pxPerMm = dpi / 25.4
    const { qr, settings: read, corners, h, cells } = cutPage(scan.image)

    expect(read).toEqual(settings)
    expect(qr.payload.pg).toBe(page)
    expect(quarterTurnsToUpright(qr.corners)).toBe(0)
    // Each marker is found within half a millimetre of where it was printed.
    for (const m of layout.markers) expect(distance(corners[m.corner], scan.toPx(m.center))).toBeLessThan(0.5 * pxPerMm)
    expect(cornersConsistent(corners)).toBe(true)
    // The homography from four markers reproduces the ground truth across the page.
    const probe = { x: layout.qrRect.x, y: layout.qrRect.y }
    expect(distance(applyHomography(h, probe), scan.toPx(probe))).toBeLessThan(0.3 * pxPerMm)
    cells.forEach((cut, i) => expectColor(meanInner(cut), frameColor(frames[i])))
  })

  it('a page scanned sideways or upside down is turned by the QR and then read', () => {
    for (const turned of [1, 2, 3] as const) {
      const scan = scanPage(painted, PAINT_PX_PER_MM, layout, { dpi: 200, rotateDeg: turned * 90, paddingMm: 4 })
      const first = readQrFromRgba(scan.image, QR_QUICK_PASSES)
      if (!first.ok) throw new Error(`QR not read on a page turned ${turned * 90}°`)
      const k = quarterTurnsToUpright(first.corners)
      expect(k).toBe((4 - turned) % 4)
      // The store rotates the bitmap and carries the QR corners over by geometry instead of reading again.
      const upright = rotateRgba(scan.image, k)
      const corners: QrCornersPx = rotateQrCorners(first.corners, k, scan.image)
      const detected = detectMarkers(upright, layout, corners)
      expect(detected.found).toEqual([...CORNERS])
      const h = pageToScanHomography(layout, detected.corners as Record<Corner, Point>)
      const cut = warpCell(upright, h, { cropRect: layout.cells[5].cropRect, outWidth: 96, outHeight: 54 })
      expectColor(meanInner(cut), frameColor(frames[5]))
      // rotatePoint agrees with the pixels: a marker printed at a known place is where it says.
      const m = layout.markers[0]
      expect(distance(rotatePoint(scan.toPx(m.center), k, scan.image), detected.corners[m.corner] as Point)).toBeLessThan(0.5 * (200 / 25.4))
    }
  })

  it('a doodle over the QR leaves the markers to name the page and its orientation', () => {
    const hidden = paintPrintedPage(settings, layout, page, PAINT_PX_PER_MM, { hideQr: true })
    const scan = scanPage(hidden, PAINT_PX_PER_MM, layout, { dpi: 200 })
    const qr = readQrFromRgba(scan.image, QR_ALL_PASSES)
    expect(qr.ok).toBe(false)
    const blind = detectMarkersBlind(scan.image, layout)
    expect(blind.page).toBe(page)
    expect(blind.turns).toBe(0)
    expect(blind.decoded).toBeGreaterThanOrEqual(3)
    expect(blind.found).toEqual([...CORNERS])
    // Upside down: the markers say so.
    const flipped = detectMarkersBlind(rotateRgba(scan.image, 2), layout)
    expect(flipped.page).toBe(page)
    expect(flipped.turns).toBe(2)
  })
})

describe('ink spread', () => {
  it('both quick passes read a 300 dpi page whose modules have grown by a pixel', () => {
    // A v2 code at 300 dpi has 7.5 px per module, so a pixel of spread is mild; the real inkjet page below is
    // the case where only the thinned pass gets through. Both passes must keep reading this one.
    const painted = spreadInk(paintPrintedPage(settings, layout, 2, PAINT_PX_PER_MM))
    const scan = scanPage(painted, PAINT_PX_PER_MM, layout, { dpi: 300, rotateDeg: 1, paddingMm: 6 })
    expect(readQrFromRgba(scan.image, [{ width: 1600 }]).ok).toBe(true)
    expect(readQrFromRgba(scan.image, [{ width: 1600, thin: true }]).ok).toBe(true)
    // And the page still cuts: spread does not move the markers' centres.
    const { cells } = cutPage(scan.image, QR_QUICK_PASSES)
    expectColor(meanInner(cells[0]), frameColor(13))
  })

  it('the largest payload the QR budget allows still reads under spread at 300 dpi', () => {
    // 29 modules in 16 mm is the ceiling CONTRIBUTING gives; the trim feature will push against it.
    const large = createProjectSettings({ projectId: 'AbCdEfGh', fps: 30, grid: { cols: 10, rows: 10 }, dims: { width: 3840, height: 2160 }, duration: 206 })
    expect(qrModules(encodeQrPayload(large, MAX_PAGES)).length).toBe(29)
    const largeLayout = layoutFromSettings(large)
    const painted = spreadInk(paintPrintedPage(large, largeLayout, MAX_PAGES, PAINT_PX_PER_MM))
    const scan = scanPage(painted, PAINT_PX_PER_MM, largeLayout, { dpi: 300, rotateDeg: -1.5, paddingMm: 6 })
    const qr = readQrFromRgba(scan.image, QR_QUICK_PASSES)
    if (!qr.ok) throw new Error(`QR not read: ${qr.failure.kind}`)
    expect(qr.payload.pg).toBe(MAX_PAGES)
    expect(settingsFromQr(qr.payload)).toEqual(large)
  })
})

describe('a real inkjet scan', () => {
  // Page 1 of a four-page inkjet print of the sample clip, scanned at 300 dpi on a flatbed with the page's top edge
  // along the right side of the bed, downscaled to 1600 px across and kept as grayscale JPEG. It carries the v1 JSON payload.
  const jpeg = decodeJpeg(readFileSync(join(__dirname, 'fixtures/inkjet-page.jpg')), { useTArray: true, formatAsRGBA: true })
  const scan: RgbaImage = { width: jpeg.width, height: jpeg.height, data: new Uint8ClampedArray(jpeg.data.buffer, jpeg.data.byteOffset, jpeg.data.byteLength) as Uint8ClampedArray<ArrayBuffer> }

  it('is beyond the plain pass and read by the thinned one', () => {
    expect(readQrFromRgba(scan, [{ width: 1600 }]).ok).toBe(false)
    const thinned = readQrFromRgba(scan, [{ width: 1600, thin: true }])
    expect(thinned.ok).toBe(true)
    if (!thinned.ok) return
    expect(thinned.payload).toMatchObject({ v: 1, p: 'yAEj', pg: 1, of: 4, n: 40, fps: 8, g: '4x3' })
  })

  it('comes upright from its QR, and its markers sit where the QR predicts', () => {
    const qr = readQrFromRgba(scan, QR_QUICK_PASSES)
    if (!qr.ok) throw new Error('QR not read')
    const k = quarterTurnsToUpright(qr.corners)
    // Top edge on the right: three clockwise quarter turns (one anticlockwise) bring it upright.
    expect(k).toBe(3)
    const upright = rotateRgba(scan, k)
    const corners = rotateQrCorners(qr.corners, k, scan)
    const real = layoutFromSettings(settingsFromQr(qr.payload))
    const detected = detectMarkers(upright, real, corners)
    expect(detected.found).toEqual([...CORNERS])
    const found = detected.corners as Record<Corner, Point>
    expect(cornersConsistent(found)).toBe(true)
    // The similarity from a 16 mm code, extrapolated to the page corners, is off by up to 5.6 mm on this page;
    // the search window is 15 mm. A tighter geometric check for auto-apply has to live with that.
    const offMm = CORNERS.map((c) => distance(found[c], detected.predicted[c]) / detected.pxPerMm)
    expect(Math.max(...offMm), `marker offsets in mm: ${offMm.map((v) => v.toFixed(1)).join(', ')}`).toBeLessThan(8)
    // Four markers make a homography that puts the QR back where it is printed.
    const h: Homography = pageToScanHomography(real, found)
    const qrCentre = { x: real.qrRect.x + real.qrRect.w / 2, y: real.qrRect.y + real.qrRect.h / 2 }
    const seen = { x: (corners.topLeft.x + corners.bottomRight.x) / 2, y: (corners.topLeft.y + corners.bottomRight.y) / 2 }
    expect(distance(applyHomography(h, qrCentre), seen)).toBeLessThan(1.5 * detected.pxPerMm)
  })
})
