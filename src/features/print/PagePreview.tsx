import { useEffect, useRef, useState } from 'react'
import { deriveLayout, deriveSettings, previewFrameNumbers, useAppStore } from '../../app/store'
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

  // Make sure the frames of the shown page are decoded.
  const pageFrames = settings ? previewFrameNumbers(settings, previewPage) : []
  const missing = pageFrames.some((f) => !frames.has(f))
  useEffect(() => {
    if (settings && missing) void ensureFrames(pageFrames)
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
      <div ref={wrapRef} className="flex aspect-[297/210] items-center justify-center rounded-lg border border-dashed border-neutral-300 text-sm text-neutral-400">
        Preview
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Preview</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPreviewPage(Math.max(1, previewPage - 1))} disabled={previewPage <= 1} className="rounded border border-neutral-300 px-2 py-0.5 disabled:opacity-40" aria-label="previous page">
            ◀
          </button>
          <span className="tabular-nums">
            {previewPage} / {settings.pageCount}
          </span>
          <button type="button" onClick={() => setPreviewPage(Math.min(settings.pageCount, previewPage + 1))} disabled={previewPage >= settings.pageCount} className="rounded border border-neutral-300 px-2 py-0.5 disabled:opacity-40" aria-label="next page">
            ▶
          </button>
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full rounded border border-neutral-200 shadow-sm" />
    </div>
  )
}
