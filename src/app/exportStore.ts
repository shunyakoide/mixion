import { create } from 'zustand'
import { DEFAULT_EXPORT_OPTIONS, parseExportOptions, type ExportOptions } from '../domain/exportOptions'

const STORAGE_KEY = 'mixion.export'

function load(): ExportOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? parseExportOptions(JSON.parse(raw)) : DEFAULT_EXPORT_OPTIONS
  } catch {
    return DEFAULT_EXPORT_OPTIONS
  }
}

interface ExportState extends ExportOptions {
  update: (patch: Partial<ExportOptions>) => void
}

/** Export choices, remembered in this browser across projects. */
export const useExportStore = create<ExportState>((set, get) => ({
  ...load(),
  update: (patch) => {
    set(patch)
    const { size, quality, gifWidth } = get()
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ size, quality, gifWidth }))
    } catch {
      // Not persisting is fine; the choice lasts for this page.
    }
  },
}))
