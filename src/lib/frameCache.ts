/**
 * Decode-ahead cache for playing a list of frames. A window of decoded frames
 * follows the playhead: the next ones are decoded in the background, what
 * falls behind is closed. Decoding is injected so the scheduling runs in tests.
 */
export interface Closable {
  close(): void
}

export interface FrameCacheOptions {
  /** Frames kept decoded from the playhead onwards, the playhead included. */
  ahead: number
  /** Decodes in flight at once. */
  parallel?: number
  /** Called when a frame inside the window finished decoding. */
  onDecoded?: (index: number) => void
}

export class FrameCache<T extends Closable> {
  private readonly cache = new Map<number, T>()
  private readonly pending = new Set<number>()
  private readonly failed = new Set<number>()
  private readonly ahead: number
  private readonly parallel: number
  private readonly onDecoded: ((index: number) => void) | undefined
  private readonly count: number
  private readonly decode: (index: number) => Promise<T>
  private head = 0
  private disposed = false

  constructor(count: number, decode: (index: number) => Promise<T>, options: FrameCacheOptions) {
    this.count = count
    this.decode = decode
    this.ahead = Math.max(1, Math.min(count, options.ahead))
    this.parallel = Math.max(1, options.parallel ?? 2)
    this.onDecoded = options.onDecoded
  }

  /** Move the playhead to `index` and return that frame if it is decoded. */
  at(index: number): T | null {
    if (this.disposed || this.count === 0) return null
    this.head = ((index % this.count) + this.count) % this.count
    this.evict()
    this.fill()
    return this.cache.get(this.head) ?? null
  }

  /** How many frames are decoded right now. */
  get size(): number {
    return this.cache.size
  }

  dispose(): void {
    this.disposed = true
    for (const frame of this.cache.values()) frame.close()
    this.cache.clear()
  }

  /** Distance from the playhead going forwards, wrapping at the end. */
  private distance(index: number): number {
    return (index - this.head + this.count) % this.count
  }

  private evict(): void {
    for (const [i, frame] of this.cache) {
      if (this.distance(i) >= this.ahead) {
        this.cache.delete(i)
        frame.close()
      }
    }
  }

  private fill(): void {
    if (this.disposed) return
    for (let d = 0; d < this.ahead && this.pending.size < this.parallel; d++) {
      const i = (this.head + d) % this.count
      if (this.cache.has(i) || this.pending.has(i) || this.failed.has(i)) continue
      this.pending.add(i)
      this.decode(i).then(
        (frame) => {
          this.pending.delete(i)
          if (this.disposed || this.distance(i) >= this.ahead) {
            frame.close()
          } else {
            this.cache.set(i, frame)
            this.onDecoded?.(i)
          }
          this.fill()
        },
        () => {
          // A frame that cannot be decoded is skipped for good; the player keeps showing the previous one.
          this.pending.delete(i)
          this.failed.add(i)
          this.fill()
        },
      )
    }
  }
}
