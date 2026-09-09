import { describe, expect, it } from 'vitest'
import { FrameCache } from '../src/lib/frameCache'

class Frame {
  closed = false
  readonly index: number
  constructor(index: number) {
    this.index = index
  }
  close() {
    this.closed = true
  }
}

/** A decoder whose results are handed out by the test, one frame at a time. */
function controllable() {
  const waiting = new Map<number, (f: Frame) => void>()
  const failing = new Map<number, (e: Error) => void>()
  const requested: number[] = []
  const decode = (i: number) =>
    new Promise<Frame>((resolve, reject) => {
      requested.push(i)
      waiting.set(i, resolve)
      failing.set(i, reject)
    })
  const finish = async (i: number) => {
    const r = waiting.get(i)
    if (!r) throw new Error(`frame ${i} was not requested`)
    waiting.delete(i)
    r(new Frame(i))
    await Promise.resolve()
    await Promise.resolve()
  }
  const fail = async (i: number) => {
    const r = failing.get(i)
    if (!r) throw new Error(`frame ${i} was not requested`)
    failing.delete(i)
    waiting.delete(i)
    r(new Error('bad frame'))
    await Promise.resolve()
    await Promise.resolve()
  }
  return { decode, finish, fail, requested }
}

describe('FrameCache', () => {
  it('returns nothing until the frame is decoded, then hands it out', async () => {
    const d = controllable()
    const cache = new FrameCache(10, d.decode, { ahead: 4, parallel: 2 })
    expect(cache.at(0)).toBeNull()
    expect(d.requested).toEqual([0, 1])
    await d.finish(0)
    expect(cache.at(0)?.index).toBe(0)
    expect(d.requested).toEqual([0, 1, 2])
  })

  it('keeps decoding ahead of the playhead and closes what falls behind', async () => {
    const d = controllable()
    const cache = new FrameCache(10, d.decode, { ahead: 3, parallel: 3 })
    cache.at(0)
    await d.finish(0)
    await d.finish(1)
    await d.finish(2)
    expect(cache.size).toBe(3)
    const first = cache.at(0) as Frame
    cache.at(2)
    expect(first.closed).toBe(true)
    expect(cache.size).toBe(1)
    expect(d.requested).toEqual([0, 1, 2, 3, 4])
  })

  it('wraps the window around the end of the list', async () => {
    const d = controllable()
    const cache = new FrameCache(5, d.decode, { ahead: 3, parallel: 3 })
    cache.at(4)
    expect(d.requested).toEqual([4, 0, 1])
    await d.finish(4)
    expect(cache.at(4)?.index).toBe(4)
    expect(cache.at(-1)?.index).toBe(4)
  })

  it('never keeps more frames than there are', () => {
    const d = controllable()
    const cache = new FrameCache(2, d.decode, { ahead: 50, parallel: 8 })
    cache.at(0)
    expect(d.requested).toEqual([0, 1])
  })

  it('closes a frame that arrives after the window moved on or after dispose', async () => {
    const d = controllable()
    const cache = new FrameCache(10, d.decode, { ahead: 2, parallel: 2 })
    cache.at(0)
    cache.at(5)
    await d.finish(0)
    expect(cache.size).toBe(0)
    expect(d.requested).toEqual([0, 1, 5])
    await d.finish(1)
    expect(cache.size).toBe(0)
    expect(d.requested).toEqual([0, 1, 5, 6])
    await d.finish(5)
    const kept = cache.at(5) as Frame
    cache.dispose()
    expect(kept.closed).toBe(true)
    await d.finish(6)
    expect(cache.at(6)).toBeNull()
  })

  it('reports decoded frames and gives up on ones that fail', async () => {
    const d = controllable()
    const decoded: number[] = []
    const cache = new FrameCache(4, d.decode, { ahead: 2, parallel: 1, onDecoded: (i) => decoded.push(i) })
    cache.at(0)
    await d.fail(0)
    expect(d.requested).toEqual([0, 1])
    await d.finish(1)
    expect(decoded).toEqual([1])
    cache.at(0)
    expect(cache.at(0)).toBeNull()
    expect(d.requested.filter((i) => i === 0)).toHaveLength(1)
  })
})
