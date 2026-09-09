import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import { MediaError } from '../errors'

export interface EncodeGifOptions {
  frames: Blob[]
  fps: number
  /** Output width in px; height follows the frame aspect. */
  width?: number
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

/** Looping GIF with a per-frame 256-colour palette. Runs on the main thread, yielding between frames. */
export async function encodeGif(options: EncodeGifOptions): Promise<Blob> {
  const { frames, fps } = options
  if (frames.length === 0) throw new MediaError({ code: 'noFrames' })
  const first = await createImageBitmap(frames[0])
  const width = Math.max(2, Math.round(options.width ?? 640))
  const height = Math.max(2, Math.round((first.height / first.width) * width))
  first.close()
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas context unavailable')
  // GIF delays are stored in 10 ms units; keep the total duration honest by accumulating.
  const frameMs = 1000 / fps
  const gif = GIFEncoder()
  let clock = 0
  for (let i = 0; i < frames.length; i++) {
    if (options.signal?.aborted) throw new DOMException('aborted', 'AbortError')
    const bm = await createImageBitmap(frames[i])
    ctx.drawImage(bm, 0, 0, width, height)
    bm.close()
    const rgba = ctx.getImageData(0, 0, width, height).data
    const palette = quantize(rgba, 256)
    const index = applyPalette(rgba, palette)
    const target = (i + 1) * frameMs
    const delay = Math.round((target - clock) / 10) * 10
    clock += delay
    gif.writeFrame(index, width, height, { palette, delay, repeat: 0 })
    options.onProgress?.(i + 1, frames.length)
    await new Promise((r) => setTimeout(r, 0))
  }
  gif.finish()
  const bytes = gif.bytes()
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: 'image/gif' })
}
