import { LOCALES, useLocaleStore, useT } from './index'

/** Shows the language you can switch to, so it reads as an action rather than a status. */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  const other = LOCALES.find((l) => l.id !== locale) ?? LOCALES[0]
  return (
    <button
      type="button"
      onClick={() => setLocale(other.id)}
      lang={other.id}
      aria-label={t.header.switchLanguage}
      className={['h-9 whitespace-nowrap rounded-full px-3 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface hover:text-ink', className].join(' ')}
    >
      {other.label}
    </button>
  )
}
