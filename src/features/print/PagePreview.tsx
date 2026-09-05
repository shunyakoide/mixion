import { useEffect, useRef, useState } from 'react'
import { deriveLayout, deriveSettings, previewFrameNumbers, useAppStore } from '../../app/store'
import { ChevronLeft, ChevronRight } from '../../components/ui/icons'
import { CanvasPainter } from './canvasPainter'
import { buildPageSpec, paintPage } from './pagePainter'

/** Renders the current preview page with the same painter the PDF uses. */
export function PagePreview() {
  const { info, fps, gridKey, projectId, frames, previewPage, setPreviewPage, ensureFrames } = useAppStore()
  const settings = deriveSettings({ info, fps, gridKey, projectId })
  const layout = deriveLayout(settings)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)

  // Track container width.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(Math.max(200, Math.floor(entries[0].contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Make sure the frames of the shown page are decoded, then prefetch the next page.
  const pageFrames = settings ? previewFrameNumbers(settings, previewPage) : []
  const missing = pageFrames.some((f) => !frames.has(f))
  useEffect(() => {
    if (!settings) return
    if (missing) {
      void ensureFrames(pageFrames)
    } else if (previewPage < settings.pageCount) {
      void ensureFrames(previewFrameNumbers(settings, previewPage + 1))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.projectId, settings?.fps, previewPage, missing])

  // Paint.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !settings || !layout) return
    let cancelled = false
    const dpr = window.devicePixelRatio || 1
    const pxPerMm = width / layout.pageSize.w
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(layout.pageSize.h * pxPerMm * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${layout.pageSize.h * pxPerMm}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ;(async () => {
      const bitmaps = new Map<number, ImageBitmap>()
      await Promise.all(
        pageFrames.map(async (f) => {
          const blob = frames.get(f)
          if (blob) bitmaps.set(f, await createImageBitmap(blob))
        }),
      )
      if (cancelled) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const spec = buildPageSpec<CanvasImageSource>(settings, layout, previewPage, (f) => bitmaps.get(f) ?? null)
      paintPage(new CanvasPainter(ctx, pxPerMm), spec)
      for (const b of bitmaps.values()) b.close()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.projectId, settings?.fps, settings?.pageCount, gridKey, previewPage, frames, width])

  if (!settings || !layout) {
    return (
      <div ref={wrapRef} className="flex aspect-[297/210] items-center justify-center rounded-lg border border-dashed border-rule-2 text-sm text-ink-3">
        Preview
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Preview</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPreviewPage(Math.max(1, previewPage - 1))} disabled={previewPage <= 1} className="flex h-8 w-8 items-center justify-center rounded border border-rule-2 hover:border-ink-3 disabled:opacity-40" aria-label="前のページ">
            <ChevronLeft />
          </button>
          <span className="tabular-nums">
            {previewPage} / {settings.pageCount}
          </span>
          <button type="button" onClick={() => setPreviewPage(Math.min(settings.pageCount, previewPage + 1))} disabled={previewPage >= settings.pageCount} className="flex h-8 w-8 items-center justify-center rounded border border-rule-2 hover:border-ink-3 disabled:opacity-40" aria-label="次のページ">
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} className="w-full rounded border border-rule shadow-sm" />
        {missing && (
          <div className="absolute inset-x-0 top-3 flex justify-center" aria-live="polite">
            <span className="flex items-center gap-2 rounded-full bg-ink/80 px-3 py-1 text-xs text-white">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
              フレームを読み込み中…
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
