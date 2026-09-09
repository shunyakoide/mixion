/**
 * Video reading on top of WebCodecs via mediabunny. Everything stays in the
 * browser; nothing is uploaded.
 */
import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny'
import { MediaError } from '../errors'

export interface VideoInfo {
  duration: number
  width: number
  height: number
  /** Best-guess source frame rate, for display only. */
  frameRate: number | null
  hasAudio: boolean
  audioCodec: string | null
  videoCodec: string | null
  canDecodeVideo: boolean
}

function openInput(file: Blob): Input {
  return new Input({ formats: ALL_FORMATS, source: new BlobSource(file) })
}

export async function probeVideo(file: Blob): Promise<VideoInfo> {
  const input = openInput(file)
  try {
    const video = await input.getPrimaryVideoTrack()
    if (!video) throw new MediaError({ code: 'noVideoTrackInFile' })
    const audio = await input.getPrimaryAudioTrack()
    const [end, start, width, height, canDecodeVideo] = await Promise.all([
      input.computeDuration(),
      video.getFirstTimestamp(),
      video.getDisplayWidth(),
      video.getDisplayHeight(),
      video.canDecode(),
    ])
    // Some files (phone clips, trimmed exports) start later than t=0. Frame 1 is the
    // first frame of the video, so everything is measured from there.
    const duration = Math.max(0, end - start)
    let frameRate: number | null = null
    try {
      frameRate = (await video.computeFrameRateMetrics()).bestGuessFrameRate
    } catch {
      frameRate = null
    }
    return {
      duration,
      width,
      height,
      frameRate,
      hasAudio: audio !== null,
      audioCodec: audio?.codec ?? null,
      videoCodec: video.codec,
      canDecodeVideo,
    }
  } finally {
    await input.dispose()
  }
}

export interface ExtractedFrame {
  /** 0-based index into the requested timestamps. */
  index: number
  /** Requested timestamp in seconds, measured from the first frame of the video. */
  requested: number
  /** Timestamp of the frame actually used, in the file's own time. */
  actual: number
  /** JPEG bytes. */
  blob: Blob
}

export interface ExtractOptions {
  /** JPEG quality 0..1. */
  quality?: number
  onFrame?: (frame: ExtractedFrame, total: number) => void
  signal?: AbortSignal
}

/**
 * Keeps one decoder open for a video so repeated extractions (page previews,
 * the full print run) do not pay the open/seek/decoder-init cost each time.
 * Requests are queued and run one at a time; WebCodecs does not like many
 * concurrent decoders on the same file.
 */
export class FrameExtractor {
  private readonly input: Input
  private readonly ready: Promise<{ sink: CanvasSink; start: number }>
  private queue: Promise<unknown> = Promise.resolve()
  private disposed = false

  constructor(file: Blob) {
    const input = openInput(file)
    this.input = input
    this.ready = FrameExtractor.open(input)
    this.ready.catch(() => {})
  }

  private static async open(input: Input): Promise<{ sink: CanvasSink; start: number }> {
    const video = await input.getPrimaryVideoTrack()
    if (!video) throw new MediaError({ code: 'noVideoTrack' })
    if (!(await video.canDecode())) throw new MediaError({ code: 'cannotDecodeCodec', codec: video.codec ?? null })
    return { sink: new CanvasSink(video, { poolSize: 2 }), start: await video.getFirstTimestamp() }
  }

  /**
   * Decode the frame shown at each timestamp as JPEG. Timestamps count from the
   * first frame of the video, as `probeVideo`'s duration does. Past the end, the
   * last frame is reused.
   */
  extract(timestamps: number[], options: ExtractOptions = {}): Promise<ExtractedFrame[]> {
    const run = this.queue.then(() => this.run(timestamps, options))
    this.queue = run.catch(() => {})
    return run
  }

  private async run(timestamps: number[], options: ExtractOptions): Promise<ExtractedFrame[]> {
    if (this.disposed) throw new Error('extractor disposed')
    const quality = options.quality ?? 0.92
    const { sink, start } = await this.ready
    const out: ExtractedFrame[] = []
    let index = 0
    let last: ExtractedFrame | null = null
    for await (const wrapped of sink.canvasesAtTimestamps(timestamps.map((ts) => ts + start))) {
      if (options.signal?.aborted) throw new DOMException('aborted', 'AbortError')
      const requested = timestamps[index]
      let frame: ExtractedFrame
      if (wrapped) {
        const blob = await canvasToJpeg(wrapped.canvas, quality)
        frame = { index, requested, actual: wrapped.timestamp, blob }
      } else if (last) {
        frame = { ...last, index, requested }
      } else {
        throw new MediaError({ code: 'frameFailed', at: requested })
      }
      out.push(frame)
      last = frame
      options.onFrame?.(frame, timestamps.length)
      index++
    }
    return out
  }

  async dispose(): Promise<void> {
    this.disposed = true
    await this.queue
    await this.input.dispose()
  }
}

/** One-shot convenience around FrameExtractor. */
export async function extractFrames(file: Blob, timestamps: number[], options: ExtractOptions = {}): Promise<ExtractedFrame[]> {
  const extractor = new FrameExtractor(file)
  try {
    return await extractor.extract(timestamps, options)
  } finally {
    await extractor.dispose()
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement | OffscreenCanvas, quality: number): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type: 'image/jpeg', quality })
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality)
  })
}
