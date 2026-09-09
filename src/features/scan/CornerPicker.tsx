import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { MarkerGlyph } from './MarkerGlyph'
import { cornerFromPosition, cornersConsistent } from '../../domain/scan/cornerGeometry'
import { checkOrientation } from '../../domain/scan/orientation'
import { useScanStore, type QrNote, type ScanItem } from '../../app/scanStore'
import { Check, RotateCw, X } from '../../components/ui/icons'
import { Button } from '../../components/ui/Button'
import { pageToScanHomography, projectRect, type Homography } from '../../domain/homography'
import { CORNERS, type Corner, type Layout, type Point } from '../../domain/layout'
import { framesOnPage, framesPerPage } from '../../domain/frameMap'
import type { ProjectSettings } from '../../domain/settings'
import { useT, type Dict } from '../../i18n'
import { pageDuplicates } from '../../domain/scan/duplicates'

function qrNoteText(note: QrNote, t: Dict): string {
  switch (note.kind) {
    case 'noQr':
      return t.scan.errNoQr
    case 'notMixion':
      return t.scan.errNotMixionQr(note.detail)
    case 'otherProject':
      return t.scan.errOtherProject(note.projectId)
  }
}

const HIT_RADIUS = { mouse: 14, touch: 28 }
/** Corner handles and marker outlines: orange so they stand apart from the black-and-white markers and the green frame boxes. */
const CORNER_COLOR = '#f26a1b'

const LOUPE = { size: 160, zoom: 4 }

/** Put the loupe beside the cursor, flipping to the other side near the edges, so it never sits on a marker. */
function loupePosition(cursor: Point, scale: number, cssWidth: number, cssHeight: number): { left: number; top: number } {
  const gap = 24
  const cx = cursor.x * scale
  const cy = cursor.y * scale
  let left = cx + gap
  let top = cy + gap
  if (left + LOUPE.size > cssWidth) left = cx - gap - LOUPE.size
  if (top + LOUPE.size > cssHeight) top = cy - gap - LOUPE.size
  return { left: Math.max(0, left), top: Math.max(0, top) }
}

interface Props {
  scan: ScanItem
  settings: ProjectSettings
  layout: Layout
}

/**
 * Click the four marker centres (TL → TR → BR → BL), drag to adjust, with a
 * loupe and a live overlay of where the frames will be cut.
 */
export function CornerPicker({ scan, settings, layout }: Props) {
  const { setCorner, resetCorners, restoreDetectedCorners, setPage, applyScan, rotateScan, redetectScan, removeScan } = useScanStore()
  const scans = useScanStore((s) => s.scans)
  const outputFrames = useScanStore((s) => s.outputFrames)
  const duplicate = useMemo(() => pageDuplicates(scans, outputFrames, framesPerPage(settings.grid)).get(scan.id) ?? null, [scans, outputFrames, settings.grid, scan.id])
  const t = useT()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loupeRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const loaded = loadedUrl === scan.url
  const [cssWidth, setCssWidth] = useState(320)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [qrHint, setQrHint] = useState(false)
  /** Positions before each drag, newest last. Cleared when the scan changes (component is keyed by scan id). */
  const [undo, setUndo] = useState<{ corner: Corner; point: Point }[]>([])
  const [grabbing, setGrabbing] = useState(false)
  const dragging = useRef<Corner | null>(null)

  // Load the scan image.
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setLoadedUrl(scan.url)
    }
    img.src = scan.url
    return () => {
      imgRef.current = null
    }
  }, [scan.url])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((es) => setCssWidth(Math.max(200, Math.floor(es[0].contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = scan.width ? cssWidth / scan.width : 1 // css px per scan px
  const cssHeight = scan.height * scale
  const nextCorner = CORNERS.find((c) => scan.corners[c] === undefined) ?? null
  const complete = nextCorner === null
  const remaining = CORNERS.filter((c) => scan.corners[c] === undefined)
  const consistent = cornersConsistent(scan.corners)
  // Only worth warning while corners still have to be clicked: a detected set already knows where the page is.
  const orientation = scan.status === 'needs_corners' && scan.width > 0 ? checkOrientation(scan, scan.qrRect, layout) : { kind: 'ok' as const }

  // Memoised: it is a dependency of the canvas effects, and a fresh object per render would redraw the full-resolution scan on every cursor move.
  const homography = useMemo<Homography | null>(() => {
    if (!complete) return null
    try {
      return pageToScanHomography(layout, scan.corners as Record<Corner, Point>)
    } catch {
      return null
    }
  }, [complete, layout, scan.corners])

  // Draw the main canvas.
  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !loaded) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(cssWidth * dpr)
    canvas.height = Math.round(cssHeight * dpr)
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.drawImage(img, 0, 0, cssWidth, cssHeight)

    const toCss = (p: Point) => ({ x: p.x * scale, y: p.y * scale })

    if (homography) {
      const frames = framesOnPage(scan.page ?? 1, framesPerPage(settings.grid), settings.frameCount)
      ctx.lineWidth = 2
      layout.cells.forEach((cell, i) => {
        const poly = projectRect(homography as Homography, cell.cropRect).map(toCss)
        ctx.strokeStyle = i < frames.length ? 'rgba(16,185,129,0.95)' : 'rgba(160,160,160,0.6)'
        ctx.beginPath()
        poly.forEach((p, j) => (j === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
        ctx.closePath()
        ctx.stroke()
        if (i < frames.length) {
          ctx.fillStyle = 'rgba(16,185,129,0.95)'
          ctx.font = '12px sans-serif'
          ctx.fillText(`#${frames[i]}`, poly[0].x + 4, poly[0].y + 14)
        }
      })
      ctx.lineWidth = 1.5
      ctx.strokeStyle = CORNER_COLOR
      for (const m of layout.markers) {
        const poly = projectRect(homography, m.rect).map(toCss)
        ctx.beginPath()
        poly.forEach((p, j) => (j === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
        ctx.closePath()
        ctx.stroke()
      }
    }

    for (const c of CORNERS) {
      const p = scan.corners[c]
      if (!p) continue
      const q = toCss(p)
      ctx.beginPath()
      ctx.arc(q.x, q.y, 8, 0, Math.PI * 2)
      ctx.fillStyle = CORNER_COLOR
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = "bold 10px 'JetBrains Mono', monospace"
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(c + 1), q.x, q.y)
      ctx.textAlign = 'start'
      ctx.textBaseline = 'alphabetic'
    }
  }, [loaded, cssWidth, cssHeight, scale, scan.corners, scan.page, homography, layout, settings])

  // Draw the loupe.
  useEffect(() => {
    const loupe = loupeRef.current
    const img = imgRef.current
    if (!loupe || !img || !loaded) return
    const ctx = loupe.getContext('2d')
    if (!ctx) return
    const { size, zoom } = LOUPE
    loupe.width = size
    loupe.height = size
    ctx.fillStyle = '#eee'
    ctx.fillRect(0, 0, size, size)
    if (!cursor) return
    const src = size / zoom
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, cursor.x - src / 2, cursor.y - src / 2, src, src, 0, 0, size, size)
    ctx.strokeStyle = CORNER_COLOR
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(size / 2, 0)
    ctx.lineTo(size / 2, size)
    ctx.moveTo(0, size / 2)
    ctx.lineTo(size, size / 2)
    ctx.stroke()
  }, [cursor, loaded])

  const toScan = (e: PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
  }

  const hitCorner = (p: Point, radius = HIT_RADIUS.mouse): Corner | null => {
    for (const c of CORNERS) {
      const q = scan.corners[c]
      if (q && Math.hypot((q.x - p.x) * scale, (q.y - p.y) * scale) <= radius) return c
    }
    return null
  }

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Some pointers cannot be captured; dragging still works while the pointer stays over the canvas.
    }
    const p = toScan(e)
    setCursor(p)
    const hit = hitCorner(p, e.pointerType === 'touch' ? HIT_RADIUS.touch : HIT_RADIUS.mouse)
    if (hit !== null) {
      const from = scan.corners[hit]
      if (from) setUndo((u) => [...u.slice(-19), { corner: hit, point: from }])
      dragging.current = hit
      setGrabbing(true)
      return
    }
    if (nextCorner !== null) {
      // A click on the QR is a common slip: say so instead of taking it as a corner.
      const q = scan.qrRect
      if (q && p.x >= q.x - q.w * 0.15 && p.x <= q.x + q.w * 1.15 && p.y >= q.y - q.h * 0.15 && p.y <= q.y + q.h * 1.15) {
        setQrHint(true)
        return
      }
      setQrHint(false)
      // The quadrant decides which corner this is, so the markers can be clicked in any order.
      const corner = cornerFromPosition(p, scan.width, scan.height)
      setCorner(scan.id, corner, p)
      dragging.current = corner
    }
  }
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = toScan(e)
    setCursor(p)
    if (dragging.current !== null && e.buttons === 1) setCorner(scan.id, dragging.current, p)
  }
  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    dragging.current = null
    setGrabbing(false)
    // A finger has no hover: hide the loupe once it lifts.
    if (e.pointerType !== 'mouse') setCursor(null)
  }
  const undoLast = () => {
    const last = undo[undo.length - 1]
    if (!last) return
    setCorner(scan.id, last.corner, last.point)
    setUndo((u) => u.slice(0, -1))
  }
  const hovering = cursor !== null && !grabbing && hitCorner(cursor) !== null
  const detectedDiffers = CORNERS.some((c) => {
    const a = scan.corners[c]
    const d = scan.detectedCorners[c]
    return (a === undefined) !== (d === undefined) || (a && d && (a.x !== d.x || a.y !== d.y))
  })

  const busy = scan.status === 'applying'
  const canApply = (complete && homography !== null && scan.page !== null && !busy) && consistent

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="min-w-0 truncate font-mono text-[13px]" title={scan.name}>{scan.name}</span>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          {t.scan.page}
          <select
            value={scan.page ?? ''}
            onChange={(e) => setPage(scan.id, e.target.value === '' ? null : Number(e.target.value))}
            className="h-8 rounded-full bg-surface px-3 font-mono text-xs text-ink"
            disabled={busy}
          >
            <option value="">—</option>
            {Array.from({ length: settings.pageCount }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                {p} / {settings.pageCount}
              </option>
            ))}
          </select>
          {scan.pageSource === 'qr' && <span className="font-mono text-xs text-ink-3">QR</span>}
          {scan.pageSource === 'marker' && <span className="font-mono text-xs text-ink-3">{t.scan.markerSource}</span>}
          {scan.pageSource === 'order' && <span className="text-xs text-warn">{t.scan.orderSource}</span>}
        </label>
        {scan.qrNote && <span className={['text-xs', scan.pageSource === 'marker' ? 'text-ink-3' : 'text-warn'].join(' ')}>{qrNoteText(scan.qrNote, t)}</span>}
        {scan.qrNote?.kind === 'otherProject' && (
          <button
            type="button"
            onClick={() => removeScan(scan.id)}
            disabled={busy}
            className="flex h-7 items-center gap-1 rounded-full bg-surface px-2.5 text-xs text-ink transition-colors hover:bg-rule disabled:opacity-35"
          >
            <X size={12} />
            {t.scan.remove}
          </button>
        )}
        <span className="ml-auto flex items-center gap-2">
          {scan.rotation !== 0 && <span className="font-mono text-xs text-ink-3">{t.scan.rotated(scan.rotation)}</span>}
          <button
            type="button"
            onClick={() => void rotateScan(scan.id)}
            disabled={busy}
            title={t.scan.rotate}
            className="flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] text-ink transition-colors hover:bg-rule disabled:opacity-35"
          >
            <RotateCw size={14} />
            {t.scan.rotate}
          </button>
        </span>
      </div>

      {duplicate && (
        <div className="flex items-center gap-3 rounded-[14px] bg-warn/10 px-3.5 py-2.5 text-[13px] text-ink" role="status">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warn font-mono text-xs font-semibold text-white">!</span>
          <span className="min-w-0 flex-1">{t.scan.duplicatePageNote(duplicate.page, duplicate.others.join(', '))}</span>
          <span className={['shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', duplicate.inUse ? 'bg-ink text-white' : 'bg-white text-ink-2'].join(' ')}>
            {duplicate.inUse ? t.scan.duplicateInUse : t.scan.duplicateUnused}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-ink px-3.5 py-3 text-sm text-white" aria-live="polite">
        {orientation.kind !== 'ok' ? (
          <>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warn font-mono text-xs font-semibold">!</span>
            <span className="min-w-0 flex-1">
              {orientation.kind === 'qr_misplaced' ? t.scan.qrMisplaced(t.scan.corners[orientation.expected]) : t.scan.aspectMismatch}
            </span>
            <button
              type="button"
              onClick={() => void rotateScan(scan.id)}
              disabled={busy}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-medium text-ink transition-colors hover:bg-surface disabled:opacity-35"
            >
              <RotateCw size={14} />
              {t.scan.rotate}
            </button>
          </>
        ) : complete && !consistent ? (
          <>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger font-mono text-xs font-semibold">!</span>
            <span className="min-w-0 flex-1">{t.scan.inconsistent}</span>
          </>
        ) : complete && scan.page === null ? (
          <>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warn font-mono text-xs font-semibold">!</span>
            <span className="min-w-0 flex-1">{t.scan.choosePage}</span>
          </>
        ) : complete && scan.status === 'applied' ? (
          <>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok text-white">
              <Check size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t.scan.cutPage(scan.page, framesOnPage(scan.page ?? 1, framesPerPage(settings.grid), settings.frameCount).length)}</span>
              <span className="block text-[13px] text-white/60">{t.scan.adjust(true)}</span>
            </span>
          </>
        ) : complete ? (
          <>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white font-mono text-xs font-semibold text-ink">4</span>
            <span className="min-w-0 flex-1">
              {t.scan.fourSet} {t.scan.adjust(false)}
            </span>
          </>
        ) : (
          <>
            <span className={['flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold', qrHint ? 'bg-danger text-white' : 'bg-white text-ink'].join(' ')}>{qrHint ? '!' : 4 - remaining.length}</span>
            <span className="min-w-40 flex-1">
              {qrHint ? t.scan.qrHint : scan.missingCorners.length > 0 && scan.missingCorners.length < 4 ? `${t.scan.autoFound(4 - scan.missingCorners.length)} ` : ''}
              {t.scan.clickMarker}{' '}
              {remaining.map((c, i) => (
                <span key={c}>
                  {i > 0 && ' / '}
                  <strong className="font-semibold">{t.scan.corners[c]}</strong>
                </span>
              ))}
            </span>
            <span className="flex items-center gap-2">
              <MarkerGlyph page={scan.page} corner={remaining[0]} className="rounded-[3px] outline outline-1 outline-white" />
              <span className="font-mono text-xs text-white/60">{4 - remaining.length}/4</span>
            </span>
          </>
        )}
      </div>

      <div ref={wrapRef} className="relative overflow-hidden rounded-2xl">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse' && dragging.current === null) setCursor(null) }}
          className={['block w-full max-w-full touch-none bg-surface', grabbing ? 'cursor-grabbing' : hovering ? 'cursor-grab' : 'cursor-crosshair'].join(' ')}
          style={{ height: cssHeight }}
        />
        <canvas ref={loupeRef} className="pointer-events-none absolute rounded-xl bg-white shadow-page ring-1 ring-white" style={{ width: LOUPE.size, height: LOUPE.size, ...(cursor ? loupePosition(cursor, scale, cssWidth, cssHeight) : {}) }} hidden={cursor === null} />
        {!loaded && <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-3">{t.common.loading}</div>}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button id="apply-scan" onClick={() => void applyScan(scan.id)} disabled={!canApply}>
          {busy ? t.scan.cutting : scan.status === 'applied' ? t.scan.cutAgain : t.scan.apply}
        </Button>
        {undo.length > 0 && (
          <Button variant="ghost" onClick={undoLast} disabled={busy} title={t.scan.undoTitle}>
            {t.scan.undo}
          </Button>
        )}
        {Object.keys(scan.detectedCorners).length > 0 && detectedDiffers && (
          <Button variant="ghost" onClick={() => { restoreDetectedCorners(scan.id); setUndo([]) }} disabled={busy}>
            {t.scan.restoreDetected}
          </Button>
        )}
        <Button variant="secondary" onClick={() => { void redetectScan(scan.id); setUndo([]) }} disabled={busy}>
          {t.scan.redetect}
        </Button>
        <Button variant="ghost" onClick={() => { resetCorners(scan.id); setUndo([]) }} disabled={busy || Object.keys(scan.corners).length === 0}>
          {t.scan.resetCorners}
        </Button>
        {scan.status === 'applied' && <span className="text-[13px] text-ink-2">{t.scan.cutDone}</span>}
        {scan.error && <span className="text-[13px] text-danger">{scan.error}</span>}
      </div>
    </div>
  )
}
