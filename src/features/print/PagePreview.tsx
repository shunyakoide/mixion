import { useEffect, useRef, useState } from 'react'
import { deriveLayout, deriveSettings, previewFrameNumbers, useAppStore } from '../../app/store'
import type { Layout } from '../../domain/layout'
import type { ProjectSettings } from '../../domain/settings'
import { CanvasPainter } from './canvasPainter'
import { buildPageSpec, paintPage } from './pagePainter'

/** All pages in order, painted with the same painter the PDF uses. Pages render as they scroll into view. */
export function PagePreview() {
  const { info, fps, gridKey, projectId } = useAppStore()
  const settings = deriveSettings({ info, fps, gridKey, projectId })
  const layout = deriveLayout(settings)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(Math.max(200, Math.floor(entries[0].contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!settings || !layout) {
    return (
      <div ref={wrapRef} className="flex aspect-[297/210] items-center justify-center rounded-lg border border-dashed border-rule-2 text-sm text-ink-3">
        Preview
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="space-y-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">Preview</span>
        <span className="tabular-nums text-ink-2">{settings.pageCount} pages</span>
      </div>
      <ol className="space-y-6">
        {Array.from({ length: settings.pageCount }, (_, i) => (
          <li key={`${settings.projectId}-${settings.fps}-${gridKey}-${i + 1}`}>
            <PageCard settings={settings} layout={layout} page={i + 1} width={width} />
          </li>
        ))}
      </ol>
    </div>
  )
}

function PageCard({ settings, layout, page, width }: { settings: ProjectSettings; layout: Layout; page: number; width: number }) {
  const frames = useAppStore((s) => s.frames)
  const ensureFrames = useAppStore((s) => s.ensureFrames)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  const pageFrames = previewFrameNumbers(settings, page)
  const missing = pageFrames.some((f) => !frames.has(f))
  const height = (layout.pageSize.h / layout.pageSize.w) * width

  // Only pages near the viewport decode frames and paint.
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true)
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (visible && missing) void ensureFrames(pageFrames)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, missing])

  // Paint off-screen and blit in one step, and only when this page's own frames changed,
  // so a page never shows blank between two paints.
  const painted = useRef<{ blobs: (Blob | null)[]; width: number } | null>(null)
  const seq = useRef(0)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !visible) return
    const blobs = pageFrames.map((f) => frames.get(f) ?? null)
    const prev = painted.current
    if (prev && prev.width === width && prev.blobs.length === blobs.length && prev.blobs.every((b, i) => b === blobs[i])) return
    const mine = ++seq.current
    const dpr = window.devicePixelRatio || 1
    const pxPerMm = width / layout.pageSize.w
    const w = Math.round(width * dpr)
    const h = Math.round(height * dpr)
    ;(async () => {
      const bitmaps = new Map<number, ImageBitmap>()
      await Promise.all(
        pageFrames.map(async (f) => {
          const blob = frames.get(f)
          if (blob) bitmaps.set(f, await createImageBitmap(blob))
        }),
      )
      if (mine !== seq.current) {
        // A newer paint for this page was requested meanwhile; let it win.
        for (const b of bitmaps.values()) b.close()
        return
      }
      const off = new OffscreenCanvas(w, h)
      const octx = off.getContext('2d')
      const ctx = canvas.getContext('2d')
      if (!octx || !ctx) return
      octx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const spec = buildPageSpec<CanvasImageSource>(settings, layout, page, (f) => bitmaps.get(f) ?? null)
      paintPage(new CanvasPainter(octx, pxPerMm), spec)
      for (const b of bitmaps.values()) b.close()
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(off, 0, 0)
      painted.current = { blobs, width }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, frames, width, height])

  return (
    <div className="relative">
      <div className="mb-1.5 flex items-baseline justify-between text-xs text-ink-2">
        <span className="tabular-nums">
          Page {page} / {settings.pageCount}
        </span>
        <span className="tabular-nums">
          #{String(pageFrames[0]).padStart(2, '0')} – #{String(pageFrames[pageFrames.length - 1]).padStart(2, '0')}
        </span>
      </div>
      <canvas ref={canvasRef} className="block max-w-full rounded border border-rule bg-white shadow-sm" style={{ width, height }} />
      {visible && missing && (
        <div className="absolute inset-x-0 top-9 flex justify-center" aria-live="polite">
          <span className="flex items-center gap-2 rounded-full bg-ink/80 px-3 py-1 text-xs text-white">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
            フレームを読み込み中…
          </span>
        </div>
      )}
    </div>
  )
}
