import { beforeEach, describe, expect, it } from 'vitest'
import { useScanStore, type ScanItem } from '../src/app/scanStore'
import { firstUnusedPage } from '../src/app/mergePrepared'
import { GRID_PRESETS } from '../src/domain/layout'
import { createProjectSettings } from '../src/domain/settings'

const settings = createProjectSettings({
  projectId: 'test',
  fps: 8,
  grid: GRID_PRESETS['2x2'],
  dims: { width: 640, height: 360 },
  duration: 1, // 8 frames, 2 pages
})

const blob = (label: string) => new Blob([label], { type: 'text/plain' })

function scan(id: string, over: Partial<ScanItem> = {}): ScanItem {
  return {
    id,
    file: new File([''], `${id}.jpg`, { type: 'image/jpeg' }),
    name: `${id}.jpg`,
    url: `blob:${id}`,
    width: 2480,
    height: 3508,
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

const detected = { 0: { x: 100, y: 100 }, 1: { x: 2300, y: 100 }, 2: { x: 2300, y: 3400 }, 3: { x: 100, y: 3400 } }

beforeEach(() => {
  useScanStore.getState().reset()
})

describe('corners', () => {
  it('becomes ready once four corners and a page are set', () => {
    useScanStore.setState({ settings, scans: [scan('a', { page: 1, pageSource: 'qr' })] })
    const { setCorner } = useScanStore.getState()
    setCorner('a', 0, detected[0])
    setCorner('a', 1, detected[1])
    setCorner('a', 2, detected[2])
    expect(useScanStore.getState().scans[0].status).toBe('needs_corners')
    setCorner('a', 3, detected[3])
    expect(useScanStore.getState().scans[0].status).toBe('ready')
    expect(useScanStore.getState().scans[0].cornerSource).toBe('manual')
  })
  it('is no longer applied once a corner is dragged, but stays ready to cut again', () => {
    useScanStore.setState({ settings, scans: [scan('a', { page: 1, corners: detected, detectedCorners: detected, cornerSource: 'auto', status: 'applied' })] })
    useScanStore.getState().setCorner('a', 2, { x: 2200, y: 3300 })
    expect(useScanStore.getState().scans[0].status).toBe('ready')
  })
  it('restores the detected positions after a drag', () => {
    useScanStore.setState({ settings, scans: [scan('a', { page: 1, corners: detected, detectedCorners: detected, cornerSource: 'auto', status: 'applied' })] })
    const { setCorner, restoreDetectedCorners } = useScanStore.getState()
    setCorner('a', 2, { x: 2200, y: 3300 })
    setCorner('a', 0, { x: 50, y: 60 })
    restoreDetectedCorners('a')
    const s = useScanStore.getState().scans[0]
    expect(s.corners).toEqual(detected)
    expect(s.cornerSource).toBe('auto')
    expect(s.missingCorners).toEqual([])
  })
  it('lists corners the detector did not find after a restore', () => {
    const partial = { 0: detected[0], 1: detected[1], 2: detected[2] }
    useScanStore.setState({ settings, scans: [scan('a', { page: 1, corners: { ...partial, 3: { x: 1, y: 1 } }, detectedCorners: partial })] })
    useScanStore.getState().restoreDetectedCorners('a')
    const s = useScanStore.getState().scans[0]
    expect(s.corners).toEqual(partial)
    expect(s.missingCorners).toEqual([3])
    expect(s.status).toBe('needs_corners')
  })
})

describe('pages and removal', () => {
  it('marks a hand-picked page as manual', () => {
    useScanStore.setState({ settings, scans: [scan('a', { page: 1, pageSource: 'qr' })] })
    useScanStore.getState().setPage('a', 2)
    expect(useScanStore.getState().scans[0]).toMatchObject({ page: 2, pageSource: 'manual' })
  })
  it('removing a scan drops the frames it produced and keeps the rest', () => {
    const outputFrames = new Map([
      [1, { blob: blob('f1'), source: 'scan' as const, scanId: 'a' }],
      [5, { blob: blob('f5'), source: 'scan' as const, scanId: 'b' }],
    ])
    useScanStore.setState({ settings, scans: [scan('a'), scan('b')], selectedId: 'a', outputFrames })
    useScanStore.getState().removeScan('a')
    const s = useScanStore.getState()
    expect(s.scans.map((x) => x.id)).toEqual(['b'])
    expect([...s.outputFrames.keys()]).toEqual([5])
    expect(s.selectedId).toBe('b')
  })
})

describe('clearScans', () => {
  it('keeps settings the user entered by hand', () => {
    useScanStore.setState({ settings, settingsSource: 'manual', scans: [scan('a')], outputFrames: new Map([[1, { blob: blob('f1'), source: 'scan' as const }]]) })
    useScanStore.getState().clearScans()
    const s = useScanStore.getState()
    expect(s.scans).toEqual([])
    expect(s.outputFrames.size).toBe(0)
    expect(s.settings).toBe(settings)
    expect(s.settingsSource).toBe('manual')
  })
  it('forgets settings that came from a QR, so the next import restores them', () => {
    useScanStore.setState({ settings, settingsSource: 'qr', scans: [scan('a')] })
    useScanStore.getState().clearScans()
    expect(useScanStore.getState().settings).toBeNull()
    expect(useScanStore.getState().settingsSource).toBeNull()
  })
})

describe('firstUnusedPage', () => {
  it('skips pages other scans already hold and ignores the scan itself', () => {
    const scans = [
      { id: 'a', page: 1 },
      { id: 'b', page: 2 },
      { id: 'c', page: 4 },
      { id: 'me', page: null },
    ]
    expect(firstUnusedPage(scans, 'me', 4)).toBe(3)
    expect(firstUnusedPage([...scans, { id: 'd', page: 3 }], 'me', 4)).toBe(null)
    expect(firstUnusedPage([{ id: 'me', page: 2 }], 'me', 4)).toBe(1)
  })
})
