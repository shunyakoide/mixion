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
  if (frames.length === 0) throw new Error('フレームがありません')
  const { width, height } = evenDims(options.width, options.height)
  if (!(await canEncodeVideo('avc', { width, height }))) {
    throw new Error('このブラウザでは H.264 (avc) をエンコードできません')
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

  if (options.audioFrom) {
    audioInput = new Input({ formats: ALL_FORMATS, source: new BlobSource(options.audioFrom) })
    const track = await audioInput.getPrimaryAudioTrack()
    if (!track) audioNote = '元動画に音声トラックがありません'
    else if (!track.codec) audioNote = '音声コーデックを判別できません'
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
      // AAC streams usually start slightly negative (encoder priming). Shift so the
      // first packet lands at 0; the output container does not accept negative times.
      let offset = 0
      for await (const packet of sink.packets()) {
        if (first) offset = packet.timestamp < 0 ? -packet.timestamp : 0
        const timestamp = packet.timestamp + offset
        if (timestamp >= videoDuration) break
        const shifted = offset === 0 ? packet : packet.clone({ timestamp })
        await audioSource.add(shifted, first && audioDecoderConfig ? { decoderConfig: audioDecoderConfig } : undefined)
        first = false
        count++
      }
      audioSource.close()
      audioCopied = count > 0
      if (!audioCopied) audioNote = '音声パケットがありませんでした'
    }

    await output.finalize()
  } finally {
    await audioInput?.dispose()
  }

  const buffer = output.target.buffer
  if (!buffer) throw new Error('MP4 の書き出しに失敗しました')
  return { blob: new Blob([buffer], { type: 'video/mp4' }), audioCopied, audioNote }
}
