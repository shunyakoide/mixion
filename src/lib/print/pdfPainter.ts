import { rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import { mmToPt, type Point, type Rect } from '../../domain/layout'
import type { Color, Painter } from '../../domain/pagePainter'

/** Helvetica's ascender as a fraction of the em box; used to place text by its top edge. */
const ASCENT = 0.72

/** Paints a page onto a pdf-lib page. Converts mm → pt and flips the y axis. */
export class PdfPainter implements Painter<PDFImage> {
  private readonly page: PDFPage
  private readonly font: PDFFont
  private readonly pageHeightPt: number

  constructor(page: PDFPage, font: PDFFont) {
    this.page = page
    this.font = font
    this.pageHeightPt = page.getHeight()
  }

  private x(mm: number): number {
    return mmToPt(mm)
  }

  private y(mm: number): number {
    return this.pageHeightPt - mmToPt(mm)
  }

  fillRect(rect: Rect, color: Color): void {
    this.page.drawRectangle({
      x: this.x(rect.x),
      y: this.y(rect.y + rect.h),
      width: mmToPt(rect.w),
      height: mmToPt(rect.h),
      color: rgb(color.r, color.g, color.b),
      borderWidth: 0,
    })
  }

  line(from: Point, to: Point, lineWidth: number, color: Color): void {
    this.page.drawLine({
      start: { x: this.x(from.x), y: this.y(from.y) },
      end: { x: this.x(to.x), y: this.y(to.y) },
      thickness: mmToPt(lineWidth),
      color: rgb(color.r, color.g, color.b),
    })
  }

  text(text: string, pos: Point, size: number, color: Color): void {
    const sizePt = mmToPt(size)
    this.page.drawText(text, {
      x: this.x(pos.x),
      y: this.y(pos.y) - sizePt * ASCENT,
      size: sizePt,
      font: this.font,
      color: rgb(color.r, color.g, color.b),
    })
  }

  image(image: PDFImage, rect: Rect): void {
    this.page.drawImage(image, {
      x: this.x(rect.x),
      y: this.y(rect.y + rect.h),
      width: mmToPt(rect.w),
      height: mmToPt(rect.h),
    })
  }
}
