import { useEffect, useRef, useState } from 'react'
import { deriveLayout, deriveSettings, previewFrameNumbers, useAppStore } from '../../app/store'
import type { Layout } from '../../domain/layout'
import type { ProjectSettings } from '../../domain/settings'
import { CanvasPainter } from './canvasPainter'
import { buildPageSpec, paintPage } from './pagePainter'
import { useT } from '../../i18n'

/** All pages in order, painted with the same painter the PDF uses. Pages render as they scroll into view. */
export function PagePreview() {
  const { info, fps, gridKey, projectId } = useAppStore()
  const settings = deriveSettings({ info, fps, gridKey, projectId })
  const layout = deriveLayout(settings)
  const t = useT()

  if (!settings || !layout) {
    return (
      <div className="flex aspect-[297/210] items-center justify-center rounded-3xl bg-surface text-sm text-ink-3">
        {t.print.preview}
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-surface p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold tracking-[0.02em]">{t.print.preview}</span>
        <span className="font-mono text-xs text-ink-2">{t.print.previewMeta(settings.pageCount, layout.orientation === 'landscape', settings.fps, gridKey.replace('x', '×'))}</span>
      </div>
      <ol className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))]">
        {Array.from({ length: settings.pageCount }, (_, i) => (
          <li key={`${settings.projectId}-${settings.fps}-${gridKey}-${i + 1}`} className="flex min-w-0 flex-col gap-2.5">
            <PageCard settings={settings} layout={layout} page={i + 1} />
          </li>
        ))}
      </ol>
    </div>
  )
}

function PageCard({ settings, layout, page }: { settings: ProjectSettings; layout: Layout; page: number }) {
  const frames = useAppStore((s) => s.frames)
  const ensureFrames = useAppStore((s) => s.ensureFrames)
  const t = useT()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(320)
  const [visible, setVisible] = useState(false)
  const pageFrames = previewFrameNumbers(settings, page)
  const missing = pageFrames.some((f) => !frames.has(f))
  const height = (layout.pageSize.h / layout.pageSize.w) * width

  // Each card follows its own grid cell, so the columns can reflow with the window.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(Math.max(200, Math.floor(entries[0].contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
    <>
      <div ref={wrapRef} className="relative">
        <canvas ref={canvasRef} className="block max-w-full rounded-md bg-white shadow-page" style={{ width, height }} />
        {visible && missing && (
          <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center" aria-live="polite">
            <span className="flex items-center gap-2 rounded-full bg-ink/80 px-3 py-1 text-xs text-white">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
              {t.print.loadingFrames}
            </span>
          </div>
        )}
      </div>
      <div className="flex justify-between font-mono text-xs text-ink-2">
        <span className="whitespace-nowrap">{t.print.pageLabel(page)}</span>
        <span className="whitespace-nowrap">
          #{String(pageFrames[0]).padStart(2, '0')} – #{String(pageFrames[pageFrames.length - 1]).padStart(2, '0')}
        </span>
      </div>
    </>
  )
}
