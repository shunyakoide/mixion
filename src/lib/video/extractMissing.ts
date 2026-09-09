import { frameTimestamp } from '../../domain/frameMap'
import { throwIfAborted } from '../abort'
import type { FrameExtractor } from './decode'

export interface ExtractMissingOptions {
  signal?: AbortSignal
  /** Called before the first frame with `done` 0 and after each frame, so a page with nothing to do never reports. */
  onProgress?: (done: number, total: number) => void
  /** Each frame as it is decoded, so a caller can keep what a cancelled run got before the stop. */
  onFrame?: (frame: number, blob: Blob) => void
}

/**
 * Decode the frames of `wanted` that `have` does not hold yet, by frame number
 * at the project fps. Returns only the new frames; the caller merges them into
 * whatever it holds by then, so two overlapping requests do not lose each
 * other's frames. The preview page, the print run and the Animate fill all
 * come through here and differ only in which frames they want.
 */
export async function extractMissing(
  extractor: FrameExtractor,
  fps: number,
  have: ReadonlyMap<number, Blob>,
  wanted: Iterable<number>,
  options: ExtractMissingOptions = {},
): Promise<Map<number, Blob>> {
  const missing = [...new Set(wanted)].filter((f) => !have.has(f))
  const out = new Map<number, Blob>()
  if (missing.length === 0) return out
  throwIfAborted(options.signal)
  let done = 0
  options.onProgress?.(0, missing.length)
  const extracted = await extractor.extract(missing.map((f) => frameTimestamp(f, fps)), {
    signal: options.signal,
    onFrame: (frame, total) => {
      options.onFrame?.(missing[frame.index], frame.blob)
      options.onProgress?.(++done, total)
    },
  })
  extracted.forEach((e, i) => out.set(missing[i], e.blob))
  return out
}
