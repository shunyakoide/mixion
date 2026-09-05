/**
 * Mapping between frames, pages and cells. All frame and page numbers are
 * 1-based (they are printed on paper and shown to the user); cell indices
 * are 0-based in reading order (left→right, top→bottom).
 */
import type { Grid } from './layout'

export function framesPerPage(grid: Grid): number {
  return grid.cols * grid.rows
}

/**
 * Number of frames to extract from a video of `duration` seconds at `fps`.
 *
 * Frame i (1-based) is sampled at t = (i - 1) / fps. We round rather than
 * ceil so that a "5 second" clip that is really 5.005s still yields 40 frames
 * at 8fps instead of a 41st frame that would exist for only 5ms.
 * Rounding up is safe: it can only happen when duration*fps ≥ N - 0.5, so the
 * last sample time (N-1)/fps is still strictly inside the video.
 */
export function frameCount(duration: number, fps: number): number {
  if (!(duration > 0) || !(fps > 0)) return 0
  return Math.max(1, Math.round(duration * fps))
}

export function pageCount(totalFrames: number, perPage: number): number {
  if (totalFrames <= 0) return 0
  return Math.ceil(totalFrames / perPage)
}

/** 1-based page that holds 1-based `frame`. */
export function pageOf(frame: number, perPage: number): number {
  return Math.floor((frame - 1) / perPage) + 1
}

/** 0-based cell index of 1-based `frame` on its page. */
export function cellOf(frame: number, perPage: number): number {
  return (frame - 1) % perPage
}

/** 1-based frame at 1-based `page`, 0-based `cell`. */
export function frameAt(page: number, cell: number, perPage: number): number {
  return (page - 1) * perPage + cell + 1
}

/** Frames printed on 1-based `page`, clipped to `totalFrames`. */
export function framesOnPage(page: number, perPage: number, totalFrames: number): number[] {
  const first = frameAt(page, 0, perPage)
  const last = Math.min(first + perPage - 1, totalFrames)
  const out: number[] = []
  for (let f = first; f <= last; f++) out.push(f)
  return out
}

/** First and last frame on a page as a tuple, or null if the page is empty. */
export function frameRangeOnPage(page: number, perPage: number, totalFrames: number): [number, number] | null {
  const frames = framesOnPage(page, perPage, totalFrames)
  if (frames.length === 0) return null
  return [frames[0], frames[frames.length - 1]]
}

/** Timestamp in seconds at which 1-based `frame` is sampled. */
export function frameTimestamp(frame: number, fps: number): number {
  return (frame - 1) / fps
}

/** Zero-padded label, e.g. "#09". Width grows with the total count. */
export function frameLabel(frame: number, totalFrames: number): string {
  const width = Math.max(2, String(totalFrames).length)
  return `#${String(frame).padStart(width, '0')}`
}
