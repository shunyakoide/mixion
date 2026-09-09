import { create } from 'zustand'
import { MediaError, type AudioNote, type MediaErrorInfo } from '../lib/errors'
import { en, type Dict } from './en'
import { ja } from './ja'

export type Locale = 'en' | 'ja'
export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
]

const dicts: Record<Locale, Dict> = { en, ja }
const STORAGE_KEY = 'mixion.locale'

function isLocale(v: unknown): v is Locale {
  return v === 'en' || v === 'ja'
}

/** English unless the user picked a language before; the browser language is not consulted. */
function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // Storage can be unavailable (private mode, node). English it is.
  }
  return 'en'
}

function applyToDocument(locale: Locale) {
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: initialLocale(),
  setLocale: (locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // Not persisting is fine; the choice lasts for this page.
    }
    applyToDocument(locale)
    set({ locale })
  },
}))

applyToDocument(useLocaleStore.getState().locale)

/** Strings for the current language, for components. */
export function useT(): Dict {
  return dicts[useLocaleStore((s) => s.locale)]
}

/** Strings for the current language, for code outside React (stores, workers, libraries). */
export function t(): Dict {
  return dicts[useLocaleStore.getState().locale]
}

export type { Dict }

function describeMediaError(info: MediaErrorInfo, dict: Dict): string {
  const e = dict.errors
  switch (info.code) {
    case 'cannotLoadImage':
      return e.cannotLoadImage(info.name)
    case 'cannotDecodeCodec':
      return e.cannotDecodeCodec(info.codec)
    case 'frameFailed':
      return e.frameFailed(info.at)
    case 'noVideoTrackInFile':
    case 'noVideoTrack':
    case 'noFrames':
    case 'cannotEncodeH264':
    case 'mp4Failed':
      return e[info.code]
  }
}

/** The message to show for something thrown: lib's coded errors in the current language, anything else as it is. */
export function describeError(e: unknown, dict: Dict = t()): string {
  if (e instanceof MediaError) return describeMediaError(e.info, dict)
  return e instanceof Error ? e.message : String(e)
}

/** Why an MP4 export has no audio, in the current language. */
export function describeAudioNote(note: AudioNote, dict: Dict = t()): string {
  return dict.errors[note]
}
