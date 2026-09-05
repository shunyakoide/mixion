import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useScanStore, type ScanItem } from '../../app/scanStore'
import { Button } from '../../components/ui/Button'
import { pageToScanHomography, projectRect, type Homography } from '../../domain/homography'
import { CORNERS, type Corner, type Layout, type Point } from '../../domain/layout'
import { framesOnPage, framesPerPage } from '../../domain/frameMap'
import type { ProjectSettings } from '../../domain/settings'

const CORNER_LABEL: Record<Corner, string> = { 0: '左上', 1: '右上', 2: '右下', 3: '左下' }
const HIT_RADIUS = 14
const LOUPE = { size: 160, zoom: 4 }

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
  const { setCorner, resetCorners, setPage, applyScan } = useScanStore()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loupeRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const loaded = loadedUrl === scan.url
  const [cssWidth, setCssWidth] = useState(600)
  const [cursor, setCursor] = useState<Point | null>(null)
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

  let homography: Homography | null = null
  if (complete) {
    try {
      homography = pageToScanHomography(layout, scan.corners as Record<Corner, Point>)
    } catch {
      homography = null
    }
  }

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
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(59,130,246,0.9)'
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
      ctx.arc(q.x, q.y, 7, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(239,68,68,0.9)'
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = 'white'
      ctx.font = 'bold 10px sans-serif'
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
    ctx.strokeStyle = 'rgba(239,68,68,0.9)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(size / 2, 0)
    ctx.lineTo(size / 2, size)
    ctx.moveTo(0, size / 2)
    ctx.lineTo(size, size / 2)
    ctx.stroke()
  }, [cursor, loaded])

  const toScan = (e: MouseEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
  }

  const hitCorner = (p: Point): Corner | null => {
    for (const c of CORNERS) {
      const q = scan.corners[c]
      if (q && Math.hypot((q.x - p.x) * scale, (q.y - p.y) * scale) <= HIT_RADIUS) return c
    }
    return null
  }

  const onMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    const p = toScan(e)
    const hit = hitCorner(p)
    if (hit !== null) {
      dragging.current = hit
      return
    }
    if (nextCorner !== null) {
      setCorner(scan.id, nextCorner, p)
      dragging.current = nextCorner
    }
  }
  const onMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const p = toScan(e)
    setCursor(p)
    if (dragging.current !== null && e.buttons === 1) setCorner(scan.id, dragging.current, p)
  }
  const onMouseUp = () => {
    dragging.current = null
  }

  const busy = scan.status === 'applying'
  const canApply = complete && homography !== null && scan.page !== null && !busy

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">{scan.name}</span>
        <label className="flex items-center gap-2">
          Page
          <select
            value={scan.page ?? ''}
            onChange={(e) => setPage(scan.id, e.target.value === '' ? null : Number(e.target.value))}
            className="rounded border border-neutral-300 px-2 py-1"
            disabled={busy}
          >
            <option value="">—</option>
            {Array.from({ length: settings.pageCount }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                {p} / {settings.pageCount}
              </option>
            ))}
          </select>
          {scan.pageSource === 'qr' && <span className="text-xs text-green-700">QR</span>}
          {scan.pageSource === 'order' && <span className="text-xs text-amber-600">取り込み順（要確認）</span>}
        </label>
        {scan.qrNote && <span className="text-xs text-amber-600">{scan.qrNote}</span>}
        <span className="ml-auto text-neutral-500">
          {complete ? '点をドラッグで微調整' : `クリック: ${CORNER_LABEL[nextCorner as Corner]}のマーカー中心 (${(nextCorner as number) + 1}/4)`}
        </span>
      </div>

      <div ref={wrapRef} className="relative">
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { onMouseUp(); setCursor(null) }}
          className="w-full cursor-crosshair rounded border border-neutral-200 bg-neutral-100"
          style={{ height: cssHeight }}
        />
        <canvas ref={loupeRef} className="pointer-events-none absolute right-2 top-2 rounded border border-neutral-300 bg-white shadow" style={{ width: LOUPE.size, height: LOUPE.size }} />
        {!loaded && <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400">読み込み中…</div>}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => resetCorners(scan.id)} disabled={busy || Object.keys(scan.corners).length === 0}>
          Reset
        </Button>
        <Button id="apply-scan" onClick={() => void applyScan(scan.id)} disabled={!canApply}>
          {busy ? '切り出し中…' : scan.status === 'applied' ? '再適用' : 'Apply'}
        </Button>
        {scan.status === 'applied' && <span className="text-sm text-green-700">切り出し済み{scan.fitError !== null ? ` (fit ${scan.fitError.toFixed(2)} px)` : ''}</span>}
        {scan.error && <span className="text-sm text-red-600">{scan.error}</span>}
      </div>
    </div>
  )
}
