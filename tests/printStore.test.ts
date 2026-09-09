/**
 * The Print store's long runs: cancelling a PDF run while frames are being
 * decoded, clearing the video underneath it, and preview extractions that
 * overlap.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExtractedFrame, ExtractOptions, VideoInfo } from '../src/lib/video/decode'

interface PendingExtract {
  timestamps: number[]
  options: ExtractOptions
  resolve: (frames: ExtractedFrame[]) => void
}
const pending: { extracts: PendingExtract[] } = { extracts: [] }
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
        options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        pending.extracts.push({ timestamps, options, resolve })
      })
    }
    dispose(): Promise<void> {
      disposed.push(this.file.name)
      return Promise.resolve()
    }
  }
  return { FrameExtractor, probeVideo: () => Promise.resolve(info) }
})
vi.mock('../src/lib/print/buildPdf', () => ({ buildPrintPdf: () => Promise.resolve(new Uint8Array([1, 2, 3])) }))
vi.mock('../src/lib/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/files')>()),
  saveBlob: () => Promise.resolve('cancelled' as const),
}))

import { useAppStore } from '../src/app/store'

const framesFor = (timestamps: number[]): ExtractedFrame[] => timestamps.map((ts, index) => ({ index, requested: ts, actual: ts, blob: new Blob([`t${ts}`]) }))
const settle = () => new Promise((r) => setTimeout(r, 0))
async function untilExtract(count = 1) {
  for (let i = 0; i < 50 && pending.extracts.length < count; i++) await settle()
  expect(pending.extracts.length).toBeGreaterThanOrEqual(count)
}
const clip = () => new File(['x'], 'clip.mp4', { type: 'video/mp4' })

beforeEach(async () => {
  pending.extracts = []
  useAppStore.getState().clearVideo()
  useAppStore.setState({ fps: 8, gridKey: '2x2' })
  await useAppStore.getState().loadVideo(clip())
  expect(useAppStore.getState().extractor).not.toBeNull()
  disposed.length = 0
})

describe('createPdf', () => {
  it('can be cancelled while frames are being decoded, keeping what was decoded and showing no error', async () => {
    const done = useAppStore.getState().createPdf()
    await untilExtract()
    const job = pending.extracts.shift()!
    expect(job.timestamps).toHaveLength(8)
    expect(useAppStore.getState().status).toBe('extracting')
    job.options.onFrame?.(framesFor([0])[0], 8)
    expect(useAppStore.getState().progress).toMatchObject({ done: 1, total: 8 })
    useAppStore.getState().cancelPrint()
    expect(job.options.signal?.aborted).toBe(true)
    await done
    const s = useAppStore.getState()
    expect(s.status).toBe('idle')
    expect(s.progress).toBeNull()
    expect(s.pdfError).toBeNull()
    expect(s.file).not.toBeNull()
  })
  it('runs to the save when nothing stops it, and a second click during the run is ignored', async () => {
    const done = useAppStore.getState().createPdf()
    await untilExtract()
    const again = useAppStore.getState().createPdf()
    await settle()
    expect(pending.extracts).toHaveLength(1)
    const job = pending.extracts.shift()!
    job.resolve(framesFor(job.timestamps))
    await Promise.all([done, again])
    const s = useAppStore.getState()
    expect(s.status).toBe('idle')
    expect(s.pdfError).toBeNull()
    expect(s.frames.size).toBe(8)
  })
  it('is stopped by clearing the video, before the decoder is closed', async () => {
    const done = useAppStore.getState().createPdf()
    await untilExtract()
    const job = pending.extracts.shift()!
    useAppStore.getState().clearVideo()
    expect(job.options.signal?.aborted).toBe(true)
    expect(disposed).toEqual(['clip.mp4'])
    await done
    const s = useAppStore.getState()
    expect(s.file).toBeNull()
    expect(s.status).toBe('idle')
    expect(s.pdfError).toBeNull()
  })
})

describe('ensureFrames', () => {
  it('keeps the frames of two overlapping preview requests whichever finishes first', async () => {
    const a = useAppStore.getState().ensureFrames([1, 2])
    const b = useAppStore.getState().ensureFrames([3, 4])
    await untilExtract(2)
    const [ja, jb] = pending.extracts.splice(0, 2)
    jb.resolve(framesFor(jb.timestamps))
    await b
    expect([...useAppStore.getState().frames.keys()]).toEqual([3, 4])
    ja.resolve(framesFor(ja.timestamps))
    await a
    expect([...useAppStore.getState().frames.keys()].sort()).toEqual([1, 2, 3, 4])
  })
  it('says nothing when the video is replaced under a preview request', async () => {
    const a = useAppStore.getState().ensureFrames([1, 2])
    await untilExtract()
    const job = pending.extracts.shift()!
    const next = useAppStore.getState().loadVideo(new File(['y'], 'other.mp4', { type: 'video/mp4' }))
    expect(job.options.signal?.aborted).toBe(true)
    await a
    await next
    expect(useAppStore.getState().frameError).toBeNull()
    expect(useAppStore.getState().file?.name).toBe('other.mp4')
  })
})
