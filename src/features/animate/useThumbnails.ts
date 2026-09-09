import { useEffect, useState } from 'react'
import { thumbnailBlob } from '../../lib/image'

const BATCH = 6

/**
 * Object URLs of small thumbnails for a list of frame blobs, filled in a few
 * at a time; `null` until a frame's thumbnail is ready. Frames that share a
 * blob (held frames) share a thumbnail.
 */
export function useThumbnails(frames: Blob[] | null, width = 320): (string | null)[] {
  const [urls, setUrls] = useState<(string | null)[]>([])
  useEffect(() => {
    if (!frames) return
    let cancelled = false
    const made: string[] = []
    const byBlob = new Map<Blob, Promise<string | null>>()
    const url = (blob: Blob) => {
      let p = byBlob.get(blob)
      if (!p) {
        p = thumbnailBlob(blob, width).then(
          (b) => {
            const u = URL.createObjectURL(b)
            made.push(u)
            return u
          },
          () => null,
        )
        byBlob.set(blob, p)
      }
      return p
    }
    const run = async () => {
      let current: (string | null)[] = frames.map(() => null)
      for (let start = 0; start < frames.length && !cancelled; start += BATCH) {
        const batch = frames.slice(start, start + BATCH)
        const done = await Promise.all(batch.map(url))
        if (cancelled) return
        current = current.slice()
        done.forEach((u, i) => (current[start + i] = u))
        setUrls(current)
        // Let the player's frame through between batches.
        await new Promise((r) => setTimeout(r, 0))
      }
    }
    void run()
    return () => {
      cancelled = true
      // Revoke once every pending thumbnail has settled, so none is created after the cleanup.
      void Promise.allSettled([...byBlob.values()]).then(() => made.forEach((u) => URL.revokeObjectURL(u)))
      setUrls([])
    }
  }, [frames, width])
  return urls
}
