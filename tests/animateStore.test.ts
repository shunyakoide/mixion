/**
 * The Animate store: the final frame list, filling gaps from the original
 * video, and stopping that fill when it is no longer wanted.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExtractedFrame, ExtractOptions, VideoInfo } from '../src/lib/video/decode'

interface PendingExtract {
  timestamps: number[]
  options: ExtractOptions
  resolve: (frames: ExtractedFrame[]) => void
  reject: (e: unknown) => void
}
const pending: { probes: ((info?: Partial<VideoInfo>) => void)[]; extracts: PendingExtract[] } = { probes: [], extracts: [] }
const disposed: string[] = []

vi.mock('../src/lib/video/decode', () => {
  const info: VideoInfo = { width: 640, height: 360, duration: 1, frameRate: 8, hasAudio: false, audioCodec: null, videoCodec: 'avc1', canDecodeVideo: true }
  class FrameExtractor {
    private readonly file: File
    constructor(file: File) {
      this.file = file
    }
    extract(timestamps: number[], options: ExtractOptions = {}): Promise<ExtractedFrame[]> {
      return new Promise((resolve, reject) => {
        const entry: PendingExtract = { timestamps, options, resolve, reject }
        options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        pending.extracts.push(entry)
      })
    }
    dispose(): Promise<void> {
      disposed.push(this.file.name)
      return Promise.resolve()
    }
  }
  return {
    FrameExtractor,
    probeVideo: () => new Promise<VideoInfo>((resolve) => pending.probes.push((over) => resolve({ ...info, ...over }))),
  }
})

import { useAnimateStore } from '../src/app/animateStore'
import { GRID_PRESETS } from '../src/domain/layout'
import { createProjectSettings } from '../src/domain/settings'

const settings = createProjectSettings({ projectId: 'test', fps: 8, grid: GRID_PRESETS['2x2'], dims: { width: 640, height: 360 }, duration: 1 }) // 8 frames

const blob = (label: string) => new Blob([label], { type: 'text/plain' })
const text = (b: Blob) => b.text()
const cut = (...numbers: number[]) => new Map(numbers.map((f) => [f, { blob: blob(`f${f}`) }]))
const file = (name: string) => new File(['x'], name, { type: 'video/mp4' })
const settle = () => new Promise((r) => setTimeout(r, 0))
async function until(kind: keyof typeof pending, count = 1) {
  for (let i = 0; i < 50 && pending[kind].length < count; i++) await settle()
  expect(pending[kind].length).toBeGreaterThanOrEqual(count)
}
/** Load an original and let its probe finish. */
async function loaded(name = 'orig.mp4') {
  const done = useAnimateStore.getState().loadOriginal(file(name))
  await until('probes')
  pending.probes.shift()!()
  await done
}
const framesFor = (timestamps: number[]): ExtractedFrame[] => timestamps.map((ts, index) => ({ index, requested: ts, actual: ts, blob: blob(`o${Math.round(ts * 8) + 1}`) }))

beforeEach(() => {
  pending.probes = []
  pending.extracts = []
  useAnimateStore.getState().reset()
  disposed.length = 0
})

describe('resolveFrames', () => {
  it('orders frames by number, not by the order they were cut', async () => {
    const r = await useAnimateStore.getState().resolveFrames(settings, cut(5, 1, 8, 3))
    expect(r.frames).toHaveLength(8)
    expect(await text(r.frames[0])).toBe('f1')
    expect(await text(r.frames[2])).toBe('f3')
    expect(await text(r.frames[4])).toBe('f5')
    expect(await text(r.frames[7])).toBe('f8')
  })
  it('holds the previous frame where a page is missing and there is no original video', async () => {
    const r = await useAnimateStore.getState().resolveFrames(settings, cut(1, 2, 3, 4))
    expect(r.sources).toEqual(['scan', 'scan', 'scan', 'scan', 'hold', 'hold', 'hold', 'hold'])
    expect(await text(r.frames[7])).toBe('f4')
  })
  it('takes the missing frames from the original, reporting progress, and keeps them for the next resolve', async () => {
    await loaded()
    const done = useAnimateStore.getState().resolveFrames(settings, cut(1, 2, 3, 4))
    await until('extracts')
    const job = pending.extracts.shift()!
    expect(job.timestamps).toEqual([0.5, 0.625, 0.75, 0.875])
    expect(useAnimateStore.getState().filling).toEqual({ done: 0, total: 4 })
    job.options.onFrame?.(framesFor([0.5])[0], 4)
    expect(useAnimateStore.getState().filling).toEqual({ done: 1, total: 4 })
    job.resolve(framesFor(job.timestamps))
    const r = await done
    expect(r.sources).toEqual(['scan', 'scan', 'scan', 'scan', 'original', 'original', 'original', 'original'])
    expect(await text(r.frames[4])).toBe('o5')
    expect(useAnimateStore.getState().filling).toBeNull()
    expect([...useAnimateStore.getState().originalFrames.keys()]).toEqual([5, 6, 7, 8])
    // Frame 5 is cut now: only 6 is still missing, and it is cached, so the decoder is not asked again.
    const again = await useAnimateStore.getState().resolveFrames(settings, cut(1, 2, 3, 4, 5, 7, 8))
    expect(again.sources[5]).toBe('original')
    expect(pending.extracts).toHaveLength(0)
  })
  it('stops taking frames when the caller aborts, keeping the frames decoded before the stop', async () => {
    await loaded()
    const controller = new AbortController()
    const done = useAnimateStore.getState().resolveFrames(settings, cut(1, 2, 3, 4), { signal: controller.signal })
    await until('extracts')
    const job = pending.extracts.shift()!
    job.options.onFrame?.(framesFor([0.5])[0], 4)
    controller.abort()
    expect(job.options.signal?.aborted).toBe(true)
    await expect(done).rejects.toMatchObject({ name: 'AbortError' })
    expect(useAnimateStore.getState().filling).toBeNull()
    expect([...useAnimateStore.getState().originalFrames.keys()]).toEqual([5])
    // The next resolve asks only for what is still missing.
    const next = useAnimateStore.getState().resolveFrames(settings, cut(1, 2, 3, 4))
    await until('extracts')
    const job2 = pending.extracts.shift()!
    expect(job2.timestamps).toEqual([0.625, 0.75, 0.875])
    job2.resolve(framesFor(job2.timestamps))
    expect((await next).sources.slice(4)).toEqual(['original', 'original', 'original', 'original'])
  })
  it('lets a newer resolve supersede the fill of an older one', async () => {
    await loaded()
    const first = useAnimateStore.getState().resolveFrames(settings, cut(1, 2, 3, 4))
    await until('extracts')
    const second = useAnimateStore.getState().resolveFrames(settings, cut(1, 2, 3, 4, 5))
    await until('extracts', 2)
    const [a, b] = pending.extracts.splice(0, 2)
    expect(a.options.signal?.aborted).toBe(true)
    expect(b.options.signal?.aborted).toBe(false)
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    // The older fill ending does not clear the progress of the newer one.
    expect(useAnimateStore.getState().filling).toEqual({ done: 0, total: 3 })
    b.resolve(framesFor(b.timestamps))
    await second
    expect(useAnimateStore.getState().filling).toBeNull()
  })
  it('stops the fill when the original is cleared, and drops its decoder', async () => {
    await loaded()
    const done = useAnimateStore.getState().resolveFrames(settings, cut(1, 2, 3, 4))
    await until('extracts')
    const job = pending.extracts.shift()!
    useAnimateStore.getState().clearOriginal()
    expect(job.options.signal?.aborted).toBe(true)
    await expect(done).rejects.toMatchObject({ name: 'AbortError' })
    expect(disposed).toEqual(['orig.mp4'])
    expect(useAnimateStore.getState().original).toBeNull()
  })
  it('returns an empty list for a project without frames', async () => {
    await expect(useAnimateStore.getState().resolveFrames({ ...settings, frameCount: 0 }, cut())).resolves.toEqual({ frames: [], sources: [] })
  })
})

describe('loadOriginal', () => {
  it('keeps the video chosen last, even when an earlier probe finishes later', async () => {
    const first = useAnimateStore.getState().loadOriginal(file('a.mp4'))
    const second = useAnimateStore.getState().loadOriginal(file('b.mp4'))
    await until('probes', 2)
    pending.probes[1]()
    await second
    expect(useAnimateStore.getState().original?.file.name).toBe('b.mp4')
    pending.probes[0]()
    await first
    expect(useAnimateStore.getState().original?.file.name).toBe('b.mp4')
    expect(useAnimateStore.getState().originalLoading).toBe(false)
  })
  it('does not bring a video back after it was cleared', async () => {
    const done = useAnimateStore.getState().loadOriginal(file('a.mp4'))
    await until('probes')
    useAnimateStore.getState().clearOriginal()
    pending.probes[0]()
    await done
    expect(useAnimateStore.getState().original).toBeNull()
  })
  it('keeps a video this browser cannot decode for its audio, and takes no frames from it', async () => {
    const done = useAnimateStore.getState().loadOriginal(file('a.mov'))
    await until('probes')
    pending.probes[0]({ canDecodeVideo: false, videoCodec: 'hvc1', hasAudio: true })
    await done
    const s = useAnimateStore.getState()
    expect(s.original?.file.name).toBe('a.mov')
    expect(s.originalError).toBeNull()
    const r = await s.resolveFrames(settings, cut(1, 2, 3, 4))
    expect(r.sources.slice(4)).toEqual(['hold', 'hold', 'hold', 'hold'])
    expect(pending.extracts).toHaveLength(0)
  })
  it('stops a fill from the previous original when a new one is chosen', async () => {
    await loaded('a.mp4')
    const done = useAnimateStore.getState().resolveFrames(settings, cut(1, 2, 3, 4))
    await until('extracts')
    const job = pending.extracts.shift()!
    const next = useAnimateStore.getState().loadOriginal(file('b.mp4'))
    expect(job.options.signal?.aborted).toBe(true)
    await expect(done).rejects.toMatchObject({ name: 'AbortError' })
    expect(disposed).toEqual(['a.mp4'])
    await until('probes')
    pending.probes.shift()!()
    await next
    expect(useAnimateStore.getState().original?.file.name).toBe('b.mp4')
    expect(useAnimateStore.getState().originalFrames.size).toBe(0)
  })
})

describe('exports', () => {
  it('records the last export per format and forgets both on request', () => {
    const s = useAnimateStore.getState()
    s.markExported('mp4', 'a.mp4')
    s.markExported('gif', 'a.gif')
    expect(useAnimateStore.getState().exported).toEqual({ mp4: 'a.mp4', gif: 'a.gif' })
    s.forgetExports()
    expect(useAnimateStore.getState().exported).toEqual({ mp4: null, gif: null })
  })
})
