import { describe, expect, it, vi } from 'vitest'
import type { ExtractedFrame, ExtractOptions, FrameExtractor } from '../src/lib/video/decode'
import { extractMissing } from '../src/lib/video/extractMissing'

/** An extractor that hands back one blob per timestamp, naming it by the timestamp. */
function fakeExtractor() {
  const extract = vi.fn(async (timestamps: number[], options: ExtractOptions = {}): Promise<ExtractedFrame[]> => {
    return timestamps.map((ts, index) => {
      if (options.signal?.aborted) throw new DOMException('aborted', 'AbortError')
      const frame = { index, requested: ts, actual: ts, blob: new Blob([`t${ts}`]) }
      options.onFrame?.(frame, timestamps.length)
      return frame
    })
  })
  return { extract, extractor: { extract } as unknown as FrameExtractor }
}

describe('extractMissing', () => {
  it('decodes only the frames that are not held yet, once each, at their timestamps', async () => {
    const { extract, extractor } = fakeExtractor()
    const have = new Map([[2, new Blob(['have'])]])
    const got = await extractMissing(extractor, 4, have, [1, 2, 3, 3, 4])
    expect(extract).toHaveBeenCalledTimes(1)
    expect(extract.mock.calls[0][0]).toEqual([0, 0.5, 0.75])
    expect([...got.keys()]).toEqual([1, 3, 4])
    expect(await got.get(3)!.text()).toBe('t0.5')
    expect(have.size).toBe(1)
  })
  it('does not touch the decoder when nothing is missing', async () => {
    const { extract, extractor } = fakeExtractor()
    const got = await extractMissing(extractor, 4, new Map([[1, new Blob()]]), [1])
    expect(got.size).toBe(0)
    expect(extract).not.toHaveBeenCalled()
  })
  it('reports progress from zero to the number of missing frames', async () => {
    const { extractor } = fakeExtractor()
    const onProgress = vi.fn()
    await extractMissing(extractor, 8, new Map(), [1, 2, 3], { onProgress })
    expect(onProgress.mock.calls).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ])
  })
  it('rejects without decoding when the signal is already aborted', async () => {
    const { extract, extractor } = fakeExtractor()
    const controller = new AbortController()
    controller.abort()
    await expect(extractMissing(extractor, 8, new Map(), [1], { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(extract).not.toHaveBeenCalled()
  })
})
