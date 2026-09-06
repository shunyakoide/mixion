import type { Homography } from '../../domain/homography'
import type { WarpRequest, WarpResponse } from '../../workers/warp.worker'
import { cropRgba, sourceWindow, translateHomography, type RgbaImage, type WarpJob } from './warp'

/** Enough workers to use the cores without starving the UI thread. */
const POOL_SIZE = Math.max(1, Math.min(4, (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2) - 1))

interface Task {
  req: WarpRequest
  resolve: (blob: Blob) => void
  reject: (err: Error) => void
}

const workers: { worker: Worker; busy: boolean }[] = []
const queue: Task[] = []
const inFlight = new Map<number, Task>()
let nextId = 1

function spawn() {
  const slot = { worker: new Worker(new URL('../../workers/warp.worker.ts', import.meta.url), { type: 'module' }), busy: false }
  slot.worker.onmessage = (e: MessageEvent<WarpResponse>) => {
    const task = inFlight.get(e.data.id)
    inFlight.delete(e.data.id)
    slot.busy = false
    if (task) {
      if ('blob' in e.data) task.resolve(e.data.blob)
      else task.reject(new Error(e.data.error))
    }
    pump()
  }
  workers.push(slot)
  return slot
}

function pump() {
  while (queue.length > 0) {
    let slot = workers.find((w) => !w.busy)
    if (!slot && workers.length < POOL_SIZE) slot = spawn()
    if (!slot) return
    const task = queue.shift() as Task
    slot.busy = true
    inFlight.set(task.req.id, task)
    slot.worker.postMessage(task.req, [task.req.image.data.buffer])
  }
}

/** Start the workers ahead of the first cut so their start-up overlaps with reading the pages. */
export function warmUpWarpPool(): void {
  while (workers.length < POOL_SIZE) spawn()
}

/**
 * Warp several cells of one scan off the main thread, one JPEG per cell.
 * Each cell only ships the window of the scan it samples, so the jobs spread
 * over a small worker pool instead of copying the whole page around.
 */
export function warpCells(image: RgbaImage, homography: Homography, jobs: WarpJob[], quality = 0.92): Promise<Blob[]> {
  return Promise.all(
    jobs.map((job) => {
      const win = sourceWindow(image, homography, job.cropRect)
      const req: WarpRequest = { id: nextId++, image: cropRgba(image, win), homography: translateHomography(homography, win.x, win.y), job, quality }
      return new Promise<Blob>((resolve, reject) => {
        queue.push({ req, resolve, reject })
        pump()
      })
    }),
  )
}
