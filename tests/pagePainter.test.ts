import { describe, expect, it } from 'vitest'
import { GRID_PRESETS, rectContains, type Point, type Rect } from '../src/domain/layout'
import { createProjectSettings, layoutFromSettings } from '../src/domain/settings'
import { buildPageSpec, paintModules, paintPage, type Color, type Painter } from '../src/features/print/pagePainter'

type Op =
  | { op: 'fillRect'; rect: Rect; color: Color }
  | { op: 'line'; from: Point; to: Point; lineWidth: number; color: Color }
  | { op: 'text'; text: string; pos: Point; size: number; color: Color }
  | { op: 'image'; image: string; rect: Rect }

class RecordingPainter implements Painter<string> {
  ops: Op[] = []
  fillRect(rect: Rect, color: Color) {
    this.ops.push({ op: 'fillRect', rect, color })
  }
  line(from: Point, to: Point, lineWidth: number, color: Color) {
    this.ops.push({ op: 'line', from, to, lineWidth, color })
  }
  text(text: string, pos: Point, size: number, color: Color) {
    this.ops.push({ op: 'text', text, pos, size, color })
  }
  image(image: string, rect: Rect) {
    this.ops.push({ op: 'image', image, rect })
  }
}

const settings = createProjectSettings({
  projectId: 'k7Qz',
  fps: 8,
  grid: GRID_PRESETS['2x2'],
  dims: { width: 1920, height: 1080 },
  duration: 5,
})
const layout = layoutFromSettings(settings)
const isBlack = (c: Color) => c.r === 0 && c.g === 0 && c.b === 0

describe('paintModules', () => {
  it('merges horizontal runs', () => {
    const p = new RecordingPainter()
    paintModules(p, [[true, true, false, true], [false, false, false, false], [true, true, true, true], [false, true, false, false]], { x: 0, y: 0, w: 4, h: 4 }, { r: 0, g: 0, b: 0 })
    const rects = p.ops.filter((o) => o.op === 'fillRect').map((o) => (o as { rect: Rect }).rect)
    expect(rects).toEqual([
      { x: 0, y: 0, w: 2, h: 1 },
      { x: 3, y: 0, w: 1, h: 1 },
      { x: 0, y: 2, w: 4, h: 1 },
      { x: 1, y: 3, w: 1, h: 1 },
    ])
  })
})

describe('buildPageSpec', () => {
  it('puts frames 9-12 on page 3 with markers 8..11', () => {
    const spec = buildPageSpec(settings, layout, 3, (f) => `img${f}`)
    expect(spec.frames.map((f) => f.frame)).toEqual([9, 10, 11, 12])
    expect(spec.frames.map((f) => f.label)).toEqual(['#09', '#10', '#11', '#12'])
    expect(spec.frames.map((f) => f.image)).toEqual(['img9', 'img10', 'img11', 'img12'])
    expect(spec.headerText).toContain('Page 3 / 10')
    expect(spec.headerText).toContain('#09 - #12')
    expect(spec.headerText).toContain('k7Qz')
    expect(spec.markers.map((m) => m.marker.corner)).toEqual([0, 1, 2, 3])
    expect(spec.qr.modules.length).toBeGreaterThan(20)
  })
  it('only lists the frames that exist on a short last page', () => {
    const short = createProjectSettings({ projectId: 'k7Qz', fps: 8, grid: GRID_PRESETS['2x2'], dims: { width: 1920, height: 1080 }, duration: 4.75 })
    expect(short.frameCount).toBe(38)
    const spec = buildPageSpec(short, layoutFromSettings(short), 10, () => null)
    expect(spec.frames.map((f) => f.frame)).toEqual([37, 38])
  })
  it('rejects an empty page', () => {
    expect(() => buildPageSpec(settings, layout, 11, () => null)).toThrow()
  })
})

describe('paintPage', () => {
  it('draws markers, header, QR, images, ticks and labels in the right places', () => {
    const p = new RecordingPainter()
    paintPage(p, buildPageSpec(settings, layout, 3, (f) => (f === 9 ? null : `img${f}`)))

    const fills = p.ops.filter((o): o is Extract<Op, { op: 'fillRect' }> => o.op === 'fillRect')
    const images = p.ops.filter((o): o is Extract<Op, { op: 'image' }> => o.op === 'image')
    const texts = p.ops.filter((o): o is Extract<Op, { op: 'text' }> => o.op === 'text')
    const lines = p.ops.filter((o): o is Extract<Op, { op: 'line' }> => o.op === 'line')

    // Page background first.
    expect(fills[0].rect).toEqual({ x: 0, y: 0, w: 297, h: 210 })

    // Every black rect lives inside a marker or the QR; each marker has some.
    const blackRects = fills.filter((f) => isBlack(f.color)).map((f) => f.rect)
    const homes = [...layout.markers.map((m) => m.rect), layout.qrRect]
    for (const r of blackRects) expect(homes.some((h) => rectContains(h, r, 1e-6))).toBe(true)
    for (const m of layout.markers) expect(blackRects.some((r) => rectContains(m.rect, r, 1e-6))).toBe(true)
    expect(blackRects.some((r) => rectContains(layout.qrRect, r, 1e-6))).toBe(true)

    // Three real images at their cells' image rects, one placeholder for frame 9.
    expect(images.map((i) => i.image)).toEqual(['img10', 'img11', 'img12'])
    expect(images[0].rect).toEqual(layout.cells[1].imageRect)
    expect(fills.some((f) => f.rect === layout.cells[0].imageRect || (f.rect.x === layout.cells[0].imageRect.x && f.rect.w === layout.cells[0].imageRect.w && !isBlack(f.color) && f.color.r < 1))).toBe(true)

    // Header + 4 labels + 1 placeholder label.
    expect(texts[0].text).toContain('Page 3 / 10')
    expect(texts.filter((t) => t.text === '#09')).toHaveLength(2)
    for (const label of ['#10', '#11', '#12']) expect(texts.filter((t) => t.text === label)).toHaveLength(1)
    for (const [i, cell] of layout.cells.entries()) {
      const label = texts.find((t) => t.text === `#${String(9 + i).padStart(2, '0')}` && t.pos.x === cell.labelPos.x)
      expect(label?.pos).toEqual(cell.labelPos)
    }

    // 8 crop ticks per cell, all outside the image rect and inside the page.
    expect(lines).toHaveLength(8 * 4)
    for (const cell of layout.cells) {
      const own = lines.filter((l) => {
        const cx = (l.from.x + l.to.x) / 2
        const cy = (l.from.y + l.to.y) / 2
        return cx > cell.box.x - 3 && cx < cell.box.x + cell.box.w + 3 && cy > cell.box.y - 3 && cy < cell.box.y + cell.box.h + 3
      })
      expect(own).toHaveLength(8)
      for (const l of own) {
        for (const pt of [l.from, l.to]) {
          const inside = pt.x > cell.imageRect.x && pt.x < cell.imageRect.x + cell.imageRect.w && pt.y > cell.imageRect.y && pt.y < cell.imageRect.y + cell.imageRect.h
          expect(inside).toBe(false)
          expect(pt.x).toBeGreaterThan(0)
          expect(pt.y).toBeGreaterThan(0)
        }
      }
    }
  })
})
