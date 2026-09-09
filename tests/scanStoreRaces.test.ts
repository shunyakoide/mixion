/**
 * The scan store's async actions against changes that land while they run:
 * a page removed during its cut, the list cleared during an import, a second
 * original video chosen before the first one was probed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pending: { bitmaps: (() => void)[]; warps: ((blobs: Blob[]) => void)[]; probes: (() => void)[] } = { bitmaps: [], warps: [], probes: [] }
const fakeBitmap = { width: 2480, height: 3508, close: () => undefined }

vi.mock('../src/lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/image')>()),
  loadBitmap: () => new Promise<typeof fakeBitmap>((resolve) => pending.bitmaps.push(() => resolve(fakeBitmap))),
  bitmapToRgba: () => ({ width: 4, height: 4, data: new Uint8ClampedArray(64) }),
  isImageFile: () => true,
}))
vi.mock('../src/workers/warpPool', () => ({
  warmUpWarpPool: () => undefined,
  warpCells: () => new Promise<Blob[]>((resolve) => pending.warps.push(resolve)),
}))
vi.mock('../src/features/scan/qrPage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/features/scan/qrPage')>()),
  readPageQr: () => ({ ok: false, error: 'no qr', text: null, tried: [] }),
}))
vi.mock('../src/lib/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/files')>()),
  hashBlob: (blob: Blob) => Promise.resolve(`hash-${blob.size}`),
}))
vi.mock('../src/lib/video/decode', () => ({
  probeVideo: () => new Promise<{ width: number; height: number; duration: number }>((resolve) => pending.probes.push(() => resolve({ width: 640, height: 360, duration: 1 }))),
  extractFrames: () => Promise.resolve([]),
}))

import { useScanStore, type ScanItem } from '../src/app/scanStore'
import { GRID_PRESETS } from '../src/domain/layout'
import { createProjectSettings, layoutFromSettings } from '../src/domain/settings'

const settings = createProjectSettings({ projectId: 'test', fps: 8, grid: GRID_PRESETS['2x2'], dims: { width: 640, height: 360 }, duration: 1 })
/** Marker centres as they would sit on a 10 px/mm scan of the page. */
const corners = Object.fromEntries(layoutFromSettings(settings).markers.map((m) => [m.corner, { x: m.center.x * 10, y: m.center.y * 10 }])) as ScanItem['corners']

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

/** Let queued microtasks and timers run, so an async action reaches its next await. */
const settle = () => new Promise((r) => setTimeout(r, 0))
/** Wait until the action under test is parked on the given kind of pending call. */
async function until(kind: keyof typeof pending, count = 1) {
  for (let i = 0; i < 50 && pending[kind].length < count; i++) await settle()
  expect(pending[kind].length).toBeGreaterThanOrEqual(count)
}
const file = (name: string, size = 1) => new File(['x'.repeat(size)], name, { type: 'image/jpeg' })

beforeEach(() => {
  pending.bitmaps = []
  pending.warps = []
  pending.probes = []
  useScanStore.getState().reset()
  globalThis.URL.createObjectURL ??= () => 'blob:mock'
  globalThis.URL.revokeObjectURL ??= () => undefined
})

describe('applyScan', () => {
  it('writes the cut frames back while the scan is still listed', async () => {
    useScanStore.setState({ settings, scans: [scan('a', { page: 1, corners, status: 'ready' })] })
    const done = useScanStore.getState().applyScan('a')
    await until('bitmaps')
    pending.bitmaps.shift()!()
    await until('warps')
    pending.warps.shift()!([1, 2, 3, 4].map((f) => new Blob([`f${f}`])))
    await done
    const s = useScanStore.getState()
    expect([...s.outputFrames.keys()]).toEqual([1, 2, 3, 4])
    expect(s.scans[0].status).toBe('applied')
  })
  it('drops the cut frames of a scan removed while its cells were being warped', async () => {
    useScanStore.setState({ settings, scans: [scan('a', { page: 1, corners, status: 'ready' })] })
    const done = useScanStore.getState().applyScan('a')
    await until('bitmaps')
    pending.bitmaps.shift()!()
    await until('warps')
    useScanStore.getState().removeScan('a')
    pending.warps.shift()!([1, 2, 3, 4].map((f) => new Blob([`f${f}`])))
    await done
    const s = useScanStore.getState()
    expect(s.scans).toEqual([])
    expect(s.outputFrames.size).toBe(0)
  })
})

describe('importScans', () => {
  it('reads a second drop after the first batch, not alongside it', async () => {
    const first = useScanStore.getState().importScans([file('a.jpg', 1)])
    const second = useScanStore.getState().importScans([file('b.jpg', 2)])
    await until('bitmaps')
    // Only the first batch is in the list; the second has not even been hashed yet.
    expect(useScanStore.getState().scans.map((x) => x.name)).toEqual(['a.jpg'])
    expect(useScanStore.getState().importing).toBe(true)
    // Release every page read until both batches are through.
    let settled = 0
    void first.then(() => settled++)
    void second.then(() => settled++)
    for (let i = 0; i < 100 && settled < 2; i++) {
      pending.bitmaps.shift()?.()
      await settle()
    }
    await Promise.all([first, second])
    const s = useScanStore.getState()
    expect(s.scans.map((x) => [x.name, x.status])).toEqual([
      ['a.jpg', 'needs_corners'],
      ['b.jpg', 'needs_corners'],
    ])
    expect(s.importing).toBe(false)
  })
  it('leaves nothing behind when the list is cleared during an import', async () => {
    const done = useScanStore.getState().importScans([file('a.jpg', 1), file('b.jpg', 2)])
    await until('bitmaps')
    expect(useScanStore.getState().scans).toHaveLength(2)
    useScanStore.getState().reset()
    pending.bitmaps.shift()!()
    await done
    const s = useScanStore.getState()
    expect(s.scans).toEqual([])
    expect(s.settings).toBeNull()
    expect(s.importing).toBe(false)
    // The abandoned batch did not go on decoding pages that are no longer listed.
    expect(pending.bitmaps).toHaveLength(0)
  })
})

describe('loadOriginal', () => {
  it('keeps the video chosen last, even when an earlier probe finishes later', async () => {
    const a = file('a.mp4')
    const b = file('b.mp4')
    const first = useScanStore.getState().loadOriginal(a)
    const second = useScanStore.getState().loadOriginal(b)
    await until('probes', 2)
    pending.probes[1]()
    await second
    expect(useScanStore.getState().original?.file).toBe(b)
    pending.probes[0]()
    await first
    expect(useScanStore.getState().original?.file).toBe(b)
    expect(useScanStore.getState().originalLoading).toBe(false)
  })
  it('does not bring a video back after it was cleared', async () => {
    const a = file('a.mp4')
    const done = useScanStore.getState().loadOriginal(a)
    await until('probes')
    useScanStore.getState().clearOriginal()
    pending.probes[0]()
    await done
    expect(useScanStore.getState().original).toBeNull()
  })
})
