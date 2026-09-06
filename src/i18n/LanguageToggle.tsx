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
      className={['min-h-11 whitespace-nowrap rounded-md px-2 text-sm text-ink-2 hover:bg-rule/60 hover:text-ink sm:min-h-9', className].join(' ')}
    >
      {other.label}
    </button>
  )
}
