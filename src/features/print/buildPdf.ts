import { PDFDocument, StandardFonts, type PDFImage } from 'pdf-lib'
import { framesOnPage, framesPerPage } from '../../domain/frameMap'
import { mmToPt, type Layout } from '../../domain/layout'
import { layoutFromSettings, type ProjectSettings } from '../../domain/settings'
import { buildPageSpec, paintPage } from './pagePainter'
import { PdfPainter } from './pdfPainter'

interface FrameImageBytes {
  kind: 'jpeg' | 'png'
  bytes: Uint8Array
}

export interface BuildPdfInput {
  settings: ProjectSettings
  layout?: Layout
  /** Encoded image for a frame, or null to print a placeholder. */
  getFrameImage: (frame: number) => Promise<FrameImageBytes | null>
  /** Called after each page. */
  onProgress?: (pagesDone: number, pageCount: number) => void
}

/** Build the complete print PDF (all pages) and return its bytes. */
export async function buildPrintPdf(input: BuildPdfInput): Promise<Uint8Array> {
  const { settings } = input
  const layout = input.layout ?? layoutFromSettings(settings)
  const doc = await PDFDocument.create()
  doc.setTitle(`Mixion print ${settings.projectId}`)
  doc.setProducer('Mixion')
  doc.setCreator('Mixion')
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const perPage = framesPerPage(settings.grid)

  for (let page = 1; page <= settings.pageCount; page++) {
    const frames = framesOnPage(page, perPage, settings.frameCount)
    const images = new Map<number, PDFImage>()
    for (const frame of frames) {
      const img = await input.getFrameImage(frame)
      if (!img) continue
      images.set(frame, img.kind === 'jpeg' ? await doc.embedJpg(img.bytes) : await doc.embedPng(img.bytes))
    }
    const pdfPage = doc.addPage([mmToPt(layout.pageSize.w), mmToPt(layout.pageSize.h)])
    const spec = buildPageSpec<PDFImage>(settings, layout, page, (frame) => images.get(frame) ?? null)
    paintPage(new PdfPainter(pdfPage, font), spec)
    input.onProgress?.(page, settings.pageCount)
  }

  return doc.save()
}
