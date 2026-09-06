/// <reference lib="webworker" />
import type { Homography } from '../domain/homography'
import { warpCell, type RgbaImage, type WarpJob } from '../features/scan/warp'

export interface WarpRequest {
  id: number
  /** Just the part of the scan the cell needs; `homography` already maps into its coordinates. */
  image: RgbaImage
  homography: Homography
  job: WarpJob
  quality: number
}

export type WarpResponse = { id: number; blob: Blob } | { id: number; error: string }

self.onmessage = async (e: MessageEvent<WarpRequest>) => {
  const { id, image, homography, job, quality } = e.data
  try {
    const out = warpCell(image, homography, job)
    const canvas = new OffscreenCanvas(out.width, out.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas context unavailable')
    ctx.putImageData(new ImageData(out.data, out.width, out.height), 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
    ;(self as unknown as Worker).postMessage({ id, blob } satisfies WarpResponse)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) } satisfies WarpResponse)
  }
}
