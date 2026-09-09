/**
 * The priority table of `mergePrepared`: which project a page belongs to, where
 * its settings and page number come from, and that a page of another project
 * is never placed by the markers or by import order.
 */
import { describe, expect, it } from 'vitest'
import { mergePrepared, type MergeContext, type Prepared } from '../src/app/mergePrepared'
import type { ScanItem } from '../src/app/scanStore'
import { GRID_PRESETS } from '../src/domain/layout'
import type { QrRead } from '../src/domain/scan/qrRead'
import { buildQrPayload, createProjectSettings, type ProjectSettings } from '../src/domain/settings'

const settings = createProjectSettings({ projectId: 'mine', fps: 8, grid: GRID_PRESETS['2x2'], dims: { width: 640, height: 360 }, duration: 1 }) // 8 frames, 2 pages
const other = createProjectSettings({ projectId: 'theirs', fps: 12, grid: GRID_PRESETS['3x3'], dims: { width: 1280, height: 720 }, duration: 3 })

const qrCorners = { topLeft: { x: 100, y: 100 }, topRight: { x: 260, y: 100 }, bottomRight: { x: 260, y: 260 }, bottomLeft: { x: 100, y: 260 } }
const read = (of: ProjectSettings, page: number): QrRead => ({ ok: true, payload: buildQrPayload(of, page), text: '', corners: qrCorners })
const noQr: QrRead = { ok: false, failure: { kind: 'noQr' }, text: null, tried: [] }
const found = { 0: { x: 100, y: 100 }, 1: { x: 2300, y: 100 }, 2: { x: 2300, y: 3400 }, 3: { x: 100, y: 3400 } }

function scan(id: string, over: Partial<ScanItem> = {}): ScanItem {
  return {
    id,
    file: new File([''], `${id}.jpg`, { type: 'image/jpeg' }),
    name: `${id}.jpg`,
    url: `blob:${id}`,
    width: 0,
    height: 0,
    qr: null,
    qrRect: null,
    qrNote: null,
    page: null,
    pageSource: null,
    corners: {},
    cornerSource: null,
    missingCorners: [],
    detectedCorners: {},
    status: 'needs_corners',
    error: null,
    fitError: null,
    rotation: 0,
    hash: null,
    ...over,
  }
}

function prepared(over: Partial<Prepared> = {}): Prepared {
  return { file: new File([''], 'p.jpg'), width: 2480, height: 3508, qr: noQr, detected: { corners: found, missing: [] }, markerPage: null, rotation: 0, ...over }
}

const withSettings = (scans: ScanItem[] = [], settingsSource: MergeContext['settingsSource'] = 'qr'): MergeContext => ({ settings, settingsSource, scans })
const merge = (item: ScanItem, p: Prepared, ctx: MergeContext) => mergePrepared(item, p, { ...ctx, scans: ctx.scans.some((x) => x.id === item.id) ? ctx.scans : [...ctx.scans, item] })

describe('project and settings', () => {
  it('takes the settings from the first QR read', () => {
    const r = merge(scan('a'), prepared({ qr: read(settings, 2) }), { settings: null, settingsSource: null, scans: [] })
    expect(r.settings).toEqual(settings)
    expect(r.settingsSource).toBe('qr')
    expect(r.item).toMatchObject({ page: 2, pageSource: 'qr', qrNote: null, status: 'ready' })
  })
  it('replaces settings typed in by hand with the QR of the same project', () => {
    const typed = { ...settings, fps: 6 }
    const r = merge(scan('a'), prepared({ qr: read(settings, 1) }), { settings: typed, settingsSource: 'manual', scans: [] })
    expect(r.settings).toEqual(settings)
    expect(r.settingsSource).toBe('qr')
  })
  it('replaces settings typed in under the default id with the first QR read, and places the page', () => {
    const typed = { ...other, projectId: 'manual' }
    const r = merge(scan('a'), prepared({ qr: read(settings, 2) }), { settings: typed, settingsSource: 'manual', scans: [] })
    expect(r.settings).toEqual(settings)
    expect(r.settingsSource).toBe('qr')
    expect(r.item).toMatchObject({ page: 2, pageSource: 'qr', qrNote: null })
  })
  it('holds typed settings against other projects once a page has confirmed their id', () => {
    const typed = { ...settings, fps: 6 }
    const confirming = scan('a', { qr: buildQrPayload(settings, 1), page: 1, pageSource: 'qr' })
    const r = merge(scan('b'), prepared({ qr: read(other, 1) }), { settings: typed, settingsSource: 'manual', scans: [confirming] })
    expect(r.settings).toBe(typed)
    expect(r.item).toMatchObject({ page: null, qrNote: { kind: 'otherProject', projectId: 'theirs' } })
  })
  it('keeps settings that came from a QR when a later page reads the same project', () => {
    const r = merge(scan('b'), prepared({ qr: read(settings, 2) }), withSettings())
    expect(r.settings).toBe(settings)
  })
  it('measures a page against the settings project, and without settings against the first page read', () => {
    const first = scan('a', { qr: buildQrPayload(settings, 1), page: 1, pageSource: 'qr' })
    const r = merge(scan('b'), prepared({ qr: read(other, 1) }), { settings: null, settingsSource: null, scans: [first] })
    expect(r.settings).toBeNull()
    expect(r.item.qrNote).toEqual({ kind: 'otherProject', projectId: 'theirs' })
  })
})

describe('a page from another project', () => {
  it('is not placed, not by its markers and not by import order, and is not ready', () => {
    const r = merge(scan('b'), prepared({ qr: read(other, 1), markerPage: 2 }), withSettings([scan('a', { page: 1 })]))
    expect(r.item).toMatchObject({ page: null, pageSource: null, status: 'needs_corners', qrNote: { kind: 'otherProject', projectId: 'theirs' } })
    expect(r.item.qr?.p).toBe('theirs')
    expect(r.settings).toBe(settings)
  })
  it('stays unplaced when detected again after a rotate, even when the code no longer reads', () => {
    const before = merge(scan('b'), prepared({ qr: read(other, 1) }), withSettings()).item
    const r = merge(before, prepared({ qr: noQr, markerPage: 2, rotation: 90 }), withSettings())
    expect(r.item).toMatchObject({ page: null, pageSource: null, rotation: 90, qrNote: { kind: 'otherProject', projectId: 'theirs' } })
  })
  it('is placed by its QR once the settings are switched to its project', () => {
    const before = merge(scan('b'), prepared({ qr: read(other, 2) }), withSettings()).item
    const r = merge(before, prepared({ qr: read(other, 2) }), { settings: other, settingsSource: 'manual', scans: [before] })
    expect(r.item).toMatchObject({ page: 2, pageSource: 'qr', qrNote: null })
    expect(r.settings).toEqual(other)
  })
  it('is a stranger too when it carries the project id but was printed with another grid', () => {
    const reprint = { ...settings, grid: GRID_PRESETS['3x3'], pageCount: 1 }
    const r = merge(scan('b'), prepared({ qr: read(reprint, 1), markerPage: 1 }), withSettings([scan('a', { page: 1 })]))
    expect(r.item).toMatchObject({ page: null, pageSource: null, qrNote: { kind: 'otherPrint' } })
    expect(r.settings).toBe(settings)
    const first = scan('a', { qr: buildQrPayload(settings, 1), page: 1, pageSource: 'qr' })
    const noSettings = merge(scan('b'), prepared({ qr: read(reprint, 1) }), { settings: null, settingsSource: null, scans: [first] })
    expect(noSettings.item.qrNote).toEqual({ kind: 'otherPrint' })
  })
  it('keeps a page the user chose for it by hand', () => {
    const chosen = scan('b', { qr: buildQrPayload(other, 1), qrNote: { kind: 'otherProject', projectId: 'theirs' }, page: 2, pageSource: 'manual' })
    const r = merge(chosen, prepared({ qr: read(other, 1) }), withSettings())
    expect(r.item).toMatchObject({ page: 2, pageSource: 'manual', status: 'ready' })
  })
})

describe('page priority', () => {
  it('QR beats a hand-picked page', () => {
    const r = merge(scan('a', { page: 2, pageSource: 'manual' }), prepared({ qr: read(settings, 1), markerPage: 2 }), withSettings())
    expect(r.item).toMatchObject({ page: 1, pageSource: 'qr' })
  })
  it('a hand-picked page beats the markers', () => {
    const r = merge(scan('a', { page: 2, pageSource: 'manual' }), prepared({ markerPage: 1 }), withSettings())
    expect(r.item).toMatchObject({ page: 2, pageSource: 'manual', qrNote: { kind: 'noQr' } })
  })
  it('an earlier QR read survives a re-read that finds nothing, ahead of the markers', () => {
    const earlier = scan('a', { qr: buildQrPayload(settings, 2), page: 2, pageSource: 'qr' })
    const r = merge(earlier, prepared({ markerPage: 1, rotation: 90 }), withSettings())
    expect(r.item).toMatchObject({ page: 2, pageSource: 'qr', qrNote: null, qrRect: null, rotation: 90 })
    expect(r.item.qr).toBe(earlier.qr)
  })
  it('a page placed by its markers or by import order keeps it when a re-read finds nothing', () => {
    const byMarker = scan('a', { page: 2, pageSource: 'marker' })
    expect(merge(byMarker, prepared({ rotation: 90 }), withSettings()).item).toMatchObject({ page: 2, pageSource: 'marker', qrNote: { kind: 'noQr' } })
    const byOrder = scan('b', { page: 2, pageSource: 'order' })
    expect(merge(byOrder, prepared(), withSettings([scan('a', { page: null })])).item).toMatchObject({ page: 2, pageSource: 'order' })
    // The markers still have the last word when they read.
    expect(merge(byOrder, prepared({ markerPage: 1 }), withSettings()).item).toMatchObject({ page: 1, pageSource: 'marker' })
  })
  it('the markers beat import order, but only for a page the project has', () => {
    expect(merge(scan('a'), prepared({ markerPage: 2 }), withSettings()).item).toMatchObject({ page: 2, pageSource: 'marker' })
    expect(merge(scan('a'), prepared({ markerPage: 3 }), withSettings()).item).toMatchObject({ page: 1, pageSource: 'order' })
  })
  it('falls back to the first page nobody holds', () => {
    const r = merge(scan('c'), prepared(), withSettings([scan('a', { page: 1 }), scan('b', { page: null })]))
    expect(r.item).toMatchObject({ page: 2, pageSource: 'order', qrNote: { kind: 'noQr' } })
  })
  it('has no page without settings', () => {
    const r = merge(scan('a'), prepared({ markerPage: 1 }), { settings: null, settingsSource: null, scans: [] })
    expect(r.item).toMatchObject({ page: null, pageSource: null, status: 'needs_corners' })
  })
})

describe('image and corners', () => {
  it('takes the turned image and adds up the rotation', () => {
    const file = new File([''], 'turned.jpg')
    const r = merge(scan('a', { rotation: 270 }), prepared({ file, width: 3508, height: 2480, rotation: 180 }), withSettings())
    expect(r.item).toMatchObject({ file, width: 3508, height: 2480, rotation: 90 })
  })
  it('replaces hand-placed corners with what the detector found, and clears them when it found nothing', () => {
    const placed = scan('a', { corners: found, cornerSource: 'manual', fitError: 1.5, error: 'old' })
    const partial = { corners: { 0: found[0], 1: found[1] }, missing: [2, 3] as const }
    const r = merge(placed, prepared({ detected: { corners: partial.corners, missing: [...partial.missing] } }), withSettings())
    expect(r.item).toMatchObject({ corners: partial.corners, detectedCorners: partial.corners, missingCorners: [2, 3], cornerSource: 'auto', fitError: null, error: null, status: 'needs_corners' })
    const none = merge(placed, prepared({ detected: null }), withSettings())
    expect(none.item).toMatchObject({ corners: {}, detectedCorners: {}, missingCorners: [], cornerSource: null })
  })
  it('is ready as soon as four corners and a page are there', () => {
    const r = merge(scan('a'), prepared({ qr: read(settings, 1) }), withSettings())
    expect(r.item.status).toBe('ready')
    expect(r.item.qrRect).toEqual({ x: 100, y: 100, w: 160, h: 160 })
  })
})
