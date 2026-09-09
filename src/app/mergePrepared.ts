/**
 * What an import and a re-detect have in common: taking what `prepareScan` read
 * from a page (QR, markers, orientation) and deciding the page number, the
 * corners and the project settings from it. The two used to do this separately
 * and had drifted; a page from another project came through the second path
 * with a page number from import order. This is the one place that decides.
 */
import type { Corner, Point } from '../domain/layout'
import type { QrRead } from '../domain/scan/qrRead'
import { sameSettings, settingsFromQr, type ProjectSettings, type QrPayload } from '../domain/settings'
import type { QrNote, ScanItem, ScanStatus } from './scanStore'

export interface Prepared {
  file: File
  width: number
  height: number
  qr: QrRead
  detected: { corners: Partial<Record<Corner, Point>>; missing: Corner[] } | null
  /** Page number read from the corner markers when the QR could not be. */
  markerPage: number | null
  /** Degrees clockwise the image was turned here. */
  rotation: number
}

export interface MergeContext {
  settings: ProjectSettings | null
  settingsSource: 'qr' | 'manual' | null
  /** Every listed scan, the merged one included: they say which project this is and which pages are taken. */
  scans: ScanItem[]
}

export interface Merged {
  item: ScanItem
  settings: ProjectSettings | null
  settingsSource: 'qr' | 'manual' | null
}

/**
 * Fold a `prepareScan` result into the scan it was made for. Pure: the object URL
 * for a turned image is the caller's business, so `item.url` must already be right.
 *
 * Which print run this is: the settings, when they came from a QR; settings typed in
 * by hand once some page's QR has confirmed their project id, else the first other
 * page whose QR was read; else this page decides. Typed settings stay provisional
 * until a page confirms them, so a typo or the default id does not turn every page
 * into a stranger.
 *
 * Settings come from the QR when there are none yet or they were typed in, and the
 * QR belongs to this project.
 *
 * Page, first match wins:
 *   1. the QR, when it belongs to this project
 *   2. a page chosen by hand
 *   3. an earlier QR read of this page, when this read failed (a rotate that loses the code does not lose the page)
 *   4. the corner markers, when they name a page the project has
 *   5. the page this scan already had from its markers or from import order
 *   6. the first page nobody holds, in import order
 * A QR from another project, read now or earlier, ends the list at 2: the page is not cut until
 * someone says which page it is. The same goes for a page of this project printed with other
 * settings (another grid or fps), which would be cut along the wrong lines.
 *
 * Corners are whatever the detector found this time; nothing hand-placed survives.
 */
export function mergePrepared(item: ScanItem, p: Prepared, ctx: MergeContext): Merged {
  const { qr, markerPage } = p
  let { settings, settingsSource } = ctx
  // What the page's QR says, from this read or an earlier one: a code that stops reading after a turn still counts.
  const known = qr.ok ? qr.payload : item.qr
  const stranger = known ? whyStranger(known, item, ctx) : null
  const otherProject = stranger !== null
  if (qr.ok && !otherProject && (!settings || settingsSource === 'manual')) {
    settings = settingsFromQr(qr.payload)
    settingsSource = 'qr'
  }

  const keepEarlierRead = !qr.ok && !otherProject && item.pageSource === 'qr' && item.qr !== null && item.page !== null
  const keepEarlierGuess = !qr.ok && !otherProject && (item.pageSource === 'marker' || item.pageSource === 'order') && item.page !== null
  let page: number | null = null
  let pageSource: ScanItem['pageSource'] = null
  if (qr.ok && !otherProject) {
    page = qr.payload.pg
    pageSource = 'qr'
  } else if (item.pageSource === 'manual' && item.page !== null) {
    page = item.page
    pageSource = 'manual'
  } else if (otherProject) {
    // Stays unplaced.
  } else if (keepEarlierRead) {
    page = item.page
    pageSource = 'qr'
  } else if (markerPage !== null && settings && markerPage <= settings.pageCount) {
    page = markerPage
    pageSource = 'marker'
  } else if (keepEarlierGuess) {
    page = item.page
    pageSource = item.pageSource
  } else if (settings) {
    page = firstUnusedPage(ctx.scans, item.id, settings.pageCount)
    if (page !== null) pageSource = 'order'
  }

  let qrNote: QrNote | null = null
  if (stranger) qrNote = stranger
  else if (!qr.ok && !keepEarlierRead) qrNote = qr.failure

  const merged: ScanItem = {
    ...item,
    file: p.file,
    width: p.width,
    height: p.height,
    rotation: (item.rotation + p.rotation) % 360,
    qr: qr.ok ? qr.payload : item.qr,
    qrRect: qr.ok ? bbox([qr.corners.topLeft, qr.corners.topRight, qr.corners.bottomRight, qr.corners.bottomLeft]) : null,
    qrNote,
    page,
    pageSource,
    corners: p.detected?.corners ?? {},
    cornerSource: p.detected ? 'auto' : null,
    missingCorners: p.detected?.missing ?? [],
    detectedCorners: p.detected?.corners ?? {},
    status: 'needs_corners',
    error: null,
    fitError: null,
  }
  return { item: { ...merged, status: statusFor(merged) }, settings, settingsSource }
}

/**
 * Why `known` does not belong with the pages here, or null when it does. The reference is
 * the settings when a QR made them, typed settings once a listed page's QR carries their
 * project id, else the first other page with a QR. Typed settings are matched by id only:
 * a same-project QR replaces them anyway, typos in the other fields included.
 */
function whyStranger(known: QrPayload, item: ScanItem, ctx: MergeContext): QrNote | null {
  const { settings, settingsSource } = ctx
  const otherProject: QrNote = { kind: 'otherProject', projectId: known.p }
  if (settings && settingsSource === 'qr') {
    if (known.p !== settings.projectId) return otherProject
    return sameSettings(settingsFromQr(known), settings) ? null : { kind: 'otherPrint' }
  }
  if (settings && [item, ...ctx.scans].some((x) => x.qr?.p === settings.projectId)) {
    return known.p === settings.projectId ? null : otherProject
  }
  const other = ctx.scans.find((x) => x.id !== item.id && x.qr)?.qr
  if (!other) return null
  if (known.p !== other.p) return otherProject
  return sameSettings(settingsFromQr(known), settingsFromQr(other)) ? null : { kind: 'otherPrint' }
}

/** Lowest page not yet claimed by another scan, for pages whose QR and markers could not be read. */
export function firstUnusedPage(scans: Pick<ScanItem, 'id' | 'page'>[], excludeId: string, pageCount: number): number | null {
  const used = new Set(scans.filter((x) => x.id !== excludeId && x.page !== null).map((x) => x.page))
  for (let p = 1; p <= pageCount; p++) if (!used.has(p)) return p
  return null
}

export function cornersComplete(c: Partial<Record<Corner, Point>>): c is Record<Corner, Point> {
  return c[0] !== undefined && c[1] !== undefined && c[2] !== undefined && c[3] !== undefined
}

/** The status a scan derives from its fields, once it is not busy or broken. */
export function statusFor(item: ScanItem): ScanStatus {
  if (item.status === 'applied' || item.status === 'applying' || item.status === 'reading' || item.status === 'detecting') return item.status
  if (item.error) return 'error'
  return cornersComplete(item.corners) && item.page !== null ? 'ready' : 'needs_corners'
}

function bbox(pts: Point[]): { x: number; y: number; w: number; h: number } {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}
