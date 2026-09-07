/** Saving files from the browser: File System Access API when available, download otherwise. */
import { buildZip } from './zip'

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}
interface FileSystemWritableFileStreamLike {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}
interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableFileStreamLike>
}
type ShowSaveFilePicker = (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandleLike>

function savePicker(): ShowSaveFilePicker | null {
  const w = window as unknown as { showSaveFilePicker?: ShowSaveFilePicker }
  return typeof w.showSaveFilePicker === 'function' ? w.showSaveFilePicker.bind(window) : null
}

export type SaveResult = 'saved' | 'downloaded' | 'cancelled'

/**
 * Save `blob` as `filename`. Uses the native save dialog in Chromium browsers
 * (user picks the location) and a plain download elsewhere.
 */
export async function saveBlob(blob: Blob, filename: string, mime: string): Promise<SaveResult> {
  const picker = savePicker()
  if (picker) {
    try {
      const ext = filename.includes('.') ? `.${filename.split('.').pop()}` : ''
      const handle = await picker({
        suggestedName: filename,
        types: ext ? [{ accept: { [mime]: [ext] } }] : undefined,
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return 'saved'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Fall through to a plain download on any other failure.
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

export interface NamedBlob {
  name: string
  blob: Blob
}

/** Pack `files` into one uncompressed zip and save it as `zipName`. */
export async function saveAsZip(files: NamedBlob[], zipName: string): Promise<SaveResult> {
  const entries = await Promise.all(files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) })))
  return saveBlob(new Blob([buildZip(entries)], { type: 'application/zip' }), zipName, 'application/zip')
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name)
}

export function firstFileFromDrop(e: DragEvent | React.DragEvent, predicate: (f: File) => boolean): File | null {
  const files = e.dataTransfer?.files
  if (!files) return null
  for (const f of Array.from(files)) if (predicate(f)) return f
  return null
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
