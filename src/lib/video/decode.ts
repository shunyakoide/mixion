/**
 * Video reading on top of WebCodecs via mediabunny. Everything stays in the
 * browser; nothing is uploaded.
 */
import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny'

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
    if (!video) throw new Error('この動画ファイルには映像トラックがありません')
    const audio = await input.getPrimaryAudioTrack()
    const [duration, width, height, canDecodeVideo] = await Promise.all([
      input.computeDuration(),
      video.getDisplayWidth(),
      video.getDisplayHeight(),
      video.canDecode(),
    ])
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
  /** Requested timestamp in seconds. */
  requested: number
  /** Timestamp of the frame actually used, in seconds. */
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
 * Decode the frame shown at each timestamp and return them as JPEG blobs.
 * If the requested time is beyond the last frame, the last frame is reused.
 */
export async function extractFrames(file: Blob, timestamps: number[], options: ExtractOptions = {}): Promise<ExtractedFrame[]> {
  const quality = options.quality ?? 0.92
  const input = openInput(file)
  const out: ExtractedFrame[] = []
  try {
    const video = await input.getPrimaryVideoTrack()
    if (!video) throw new Error('映像トラックがありません')
    if (!(await video.canDecode())) throw new Error(`このブラウザでは ${video.codec ?? '不明な'} コーデックをデコードできません`)
    const sink = new CanvasSink(video, { poolSize: 2 })
    let index = 0
    let last: ExtractedFrame | null = null
    for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
      if (options.signal?.aborted) throw new DOMException('aborted', 'AbortError')
      const requested = timestamps[index]
      let frame: ExtractedFrame
      if (wrapped) {
        const blob = await canvasToJpeg(wrapped.canvas, quality)
        frame = { index, requested, actual: wrapped.timestamp, blob }
      } else if (last) {
        frame = { ...last, index, requested }
      } else {
        throw new Error(`t=${requested}s のフレームを取得できませんでした`)
      }
      out.push(frame)
      last = frame
      options.onFrame?.(frame, timestamps.length)
      index++
    }
    return out
  } finally {
    await input.dispose()
  }
}

export function canvasToJpeg(canvas: HTMLCanvasElement | OffscreenCanvas, quality: number): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type: 'image/jpeg', quality })
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality)
  })
}
