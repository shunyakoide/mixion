/// <reference lib="webworker" />
import type { Homography } from '../domain/homography'
import { warpCell, type RgbaImage, type WarpJob } from '../features/scan/warp'

export interface WarpRequest {
  id: number
  image: RgbaImage
  homography: Homography
  jobs: WarpJob[]
}

export interface WarpResponse {
  id: number
  results: RgbaImage[]
}

self.onmessage = (e: MessageEvent<WarpRequest>) => {
  const { id, image, homography, jobs } = e.data
  const results = jobs.map((job) => warpCell(image, homography, job))
  const transfer = results.map((r) => r.data.buffer)
  ;(self as unknown as Worker).postMessage({ id, results } satisfies WarpResponse, transfer)
}
