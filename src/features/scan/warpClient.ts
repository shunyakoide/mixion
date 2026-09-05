import type { Homography } from '../../domain/homography'
import type { WarpRequest, WarpResponse } from '../../workers/warp.worker'
import type { RgbaImage, WarpJob } from './warp'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, (r: RgbaImage[]) => void>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../../workers/warp.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WarpResponse>) => {
      pending.get(e.data.id)?.(e.data.results)
      pending.delete(e.data.id)
    }
  }
  return worker
}

/** Warp several cells of one scan off the main thread. `image.data` is transferred (consumed). */
export function warpCells(image: RgbaImage, homography: Homography, jobs: WarpJob[]): Promise<RgbaImage[]> {
  const id = nextId++
  return new Promise((resolve) => {
    pending.set(id, resolve)
    const req: WarpRequest = { id, image, homography, jobs }
    getWorker().postMessage(req, [image.data.buffer])
  })
}
