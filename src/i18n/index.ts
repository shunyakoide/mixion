import { create } from 'zustand'
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
