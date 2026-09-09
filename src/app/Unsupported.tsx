import { useT } from '../i18n'
import type { RequiredFeature } from '../lib/support'

/** Shown instead of the steps when the browser lacks an API Mixion needs. */
export function Unsupported({ missing }: { missing: RequiredFeature[] }) {
  const t = useT()
  // WebCodecs and friends are only exposed on https:// and localhost; over plain http they look missing.
  const insecure = typeof window !== 'undefined' && window.isSecureContext === false
  return (
    <div className="mx-auto max-w-2xl pt-4 sm:pt-8">
      <h1 className="text-[32px] font-semibold leading-9 tracking-[-0.03em]">{t.unsupported.title}</h1>
      <p className="mt-3 max-w-[60ch] text-sm leading-[22px] text-ink-2">{insecure ? t.unsupported.insecure : t.unsupported.body}</p>
      <p className="mt-6 text-xs leading-5 text-ink-2">
        {t.unsupported.missing} <span className="font-mono">{missing.join(', ')}</span>
      </p>
    </div>
  )
}
