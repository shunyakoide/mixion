import { t } from '../../i18n'
/**
 * MP4 writing on top of WebCodecs via mediabunny. Video is encoded as H.264;
 * the audio track of the source file, when given, is copied packet by packet
 * without re-encoding and trimmed to the video's length.
 */
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncodeVideo,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  VideoSample,
  VideoSampleSource,
} from 'mediabunny'

export interface EncodeMp4Options {
  /** Frame images in order. Each is drawn to a canvas of `width`x`height`. */
  frames: Blob[]
  fps: number
  width: number
  height: number
  /** Source video whose audio track is copied into the output. */
  audioFrom?: Blob | null
  /** Video bitrate in bits per second. */
  bitrate?: number
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

export interface EncodeMp4Result {
  blob: Blob
  audioCopied: boolean
  /** Why audio was not copied, if it was requested. */
  audioNote: string | null
}

/** Even dimensions are required by H.264 4:2:0. */
function evenDims(width: number, height: number): { width: number; height: number } {
  return { width: width - (width % 2), height: height - (height % 2) }
}

export async function encodeMp4(options: EncodeMp4Options): Promise<EncodeMp4Result> {
  const { frames, fps } = options
  if (frames.length === 0) throw new Error(t().errors.noFrames)
  const { width, height } = evenDims(options.width, options.height)
  if (!(await canEncodeVideo('avc', { width, height }))) {
    throw new Error(t().errors.cannotEncodeH264)
  }

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  })
  const videoSource = new VideoSampleSource({
    codec: 'avc',
    quality: new Quality({ bitrate: options.bitrate ?? 8e6 }),
  })
  output.addVideoTrack(videoSource, { frameRate: fps })

  const videoDuration = frames.length / fps
  let audioCopied = false
  let audioNote: string | null = null
  let audioInput: Input | null = null
  let audioSource: EncodedAudioPacketSource | null = null
  let audioCodec: string | null = null
  let audioDecoderConfig: AudioDecoderConfig | null = null
  let audioTrackForPackets: Awaited<ReturnType<Input['getPrimaryAudioTrack']>> = null
  /** Where the source's video starts: frame 1 was taken there, so the audio has to start there too. */
  let videoStart = 0

  if (options.audioFrom) {
    audioInput = new Input({ formats: ALL_FORMATS, source: new BlobSource(options.audioFrom) })
    const track = await audioInput.getPrimaryAudioTrack()
    const videoTrack = await audioInput.getPrimaryVideoTrack()
    if (videoTrack) videoStart = await videoTrack.getFirstTimestamp()
    if (!track) audioNote = t().errors.noAudioTrack
    else if (!track.codec) audioNote = t().errors.unknownAudioCodec
    else {
      audioCodec = track.codec
      audioDecoderConfig = await track.getDecoderConfig()
      audioTrackForPackets = track
      audioSource = new EncodedAudioPacketSource(track.codec)
      output.addAudioTrack(audioSource)
    }
  }

  await output.start()

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas context unavailable')

  try {
    for (let i = 0; i < frames.length; i++) {
      if (options.signal?.aborted) throw new DOMException('aborted', 'AbortError')
      const bitmap = await createImageBitmap(frames[i])
      ctx.drawImage(bitmap, 0, 0, width, height)
      bitmap.close()
      const sample = new VideoSample(canvas, { timestamp: i / fps, duration: 1 / fps })
      await videoSource.add(sample, { keyFrame: i === 0 })
      sample.close()
      options.onProgress?.(i + 1, frames.length)
    }
    videoSource.close()

    if (audioSource && audioTrackForPackets && audioCodec) {
      const sink = new EncodedPacketSink(audioTrackForPackets)
      let first = true
      let count = 0
      // Packets are moved so the video's first frame is at 0, and whatever is left
      // before it is dropped. AAC streams also usually start slightly negative
      // (encoder priming); the first kept packet is pulled up to 0, since the output
      // container does not accept negative times.
      let offset = -videoStart
      for await (const packet of sink.packets()) {
        if (packet.timestamp + packet.duration + offset <= 0) continue
        if (first && packet.timestamp + offset < 0) offset = -packet.timestamp
        const timestamp = packet.timestamp + offset
        if (timestamp >= videoDuration) break
        const shifted = offset === 0 ? packet : packet.clone({ timestamp })
        await audioSource.add(shifted, first && audioDecoderConfig ? { decoderConfig: audioDecoderConfig } : undefined)
        first = false
        count++
      }
      audioSource.close()
      audioCopied = count > 0
      if (!audioCopied) audioNote = t().errors.noAudioPackets
    }

    await output.finalize()
  } finally {
    await audioInput?.dispose()
  }

  const buffer = output.target.buffer
  if (!buffer) throw new Error(t().errors.mp4Failed)
  return { blob: new Blob([buffer], { type: 'video/mp4' }), audioCopied, audioNote }
}
