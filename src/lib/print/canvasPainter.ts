import type { Point, Rect } from '../../domain/layout'
import type { Color, Painter } from '../../domain/pagePainter'

function css(c: Color): string {
  return `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`
}

/** Paints a page onto a 2D canvas context at `pxPerMm` pixels per millimetre. */
export class CanvasPainter implements Painter<CanvasImageSource> {
  private readonly ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  private readonly pxPerMm: number

  constructor(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, pxPerMm: number) {
    this.ctx = ctx
    this.pxPerMm = pxPerMm
  }

  private px(mm: number): number {
    return mm * this.pxPerMm
  }

  fillRect(rect: Rect, color: Color): void {
    this.ctx.fillStyle = css(color)
    this.ctx.fillRect(this.px(rect.x), this.px(rect.y), this.px(rect.w), this.px(rect.h))
  }

  line(from: Point, to: Point, lineWidth: number, color: Color): void {
    this.ctx.strokeStyle = css(color)
    this.ctx.lineWidth = Math.max(1, this.px(lineWidth))
    this.ctx.beginPath()
    this.ctx.moveTo(this.px(from.x), this.px(from.y))
    this.ctx.lineTo(this.px(to.x), this.px(to.y))
    this.ctx.stroke()
  }

  text(text: string, pos: Point, size: number, color: Color): void {
    this.ctx.fillStyle = css(color)
    this.ctx.font = `${this.px(size)}px Helvetica, Arial, sans-serif`
    this.ctx.textBaseline = 'top'
    this.ctx.fillText(text, this.px(pos.x), this.px(pos.y))
  }

  image(image: CanvasImageSource, rect: Rect): void {
    this.ctx.drawImage(image, this.px(rect.x), this.px(rect.y), this.px(rect.w), this.px(rect.h))
  }
}
