import type { Homography } from '../domain/homography'
import type { WarpRequest, WarpResponse } from './warp.worker'
import type { RgbaImage } from '../domain/scan/rgba'
import { cropRgba, sourceWindow, translateHomography, type WarpJob } from '../domain/scan/warp'

/** Enough workers to use the cores without starving the UI thread. */
const POOL_SIZE = Math.max(1, Math.min(4, (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2) - 1))

interface Task {
  req: WarpRequest
  resolve: (blob: Blob) => void
  reject: (err: Error) => void
}

/** One task per worker at a time; a worker that dies takes only its own task down. */
const workers: { worker: Worker; task: Task | null }[] = []
const queue: Task[] = []
let nextId = 1

function spawn() {
  const slot: { worker: Worker; task: Task | null } = { worker: new Worker(new URL('./warp.worker.ts', import.meta.url), { type: 'module' }), task: null }
  slot.worker.onmessage = (e: MessageEvent<WarpResponse>) => {
    const task = slot.task
    slot.task = null
    if (task && task.req.id === e.data.id) {
      if ('blob' in e.data) task.resolve(e.data.blob)
      else task.reject(new Error(e.data.error))
    }
    pump()
  }
  // The worker crashed or failed to load: fail its job, drop it, and let the next job start a fresh one.
  const fail = (message: string) => {
    const task = slot.task
    slot.task = null
    slot.worker.terminate()
    const i = workers.indexOf(slot)
    if (i >= 0) workers.splice(i, 1)
    task?.reject(new Error(message))
    pump()
  }
  slot.worker.onerror = (e) => fail(e.message || 'warp worker failed')
  slot.worker.onmessageerror = () => fail('warp worker sent an unreadable message')
  workers.push(slot)
  return slot
}

function pump() {
  while (queue.length > 0) {
    let slot = workers.find((w) => w.task === null)
    if (!slot && workers.length < POOL_SIZE) slot = spawn()
    if (!slot) return
    const task = queue.shift() as Task
    slot.task = task
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
