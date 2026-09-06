import { Check } from '../components/ui/icons'
import { useAppStore } from './store'
import { useStepProgress } from './useStepProgress'
import { useT } from '../i18n'

/** Header stepper: a numbered badge per step, the current one underlined across the header's full height. */
export function Steps() {
  const setStep = useAppStore((s) => s.setStep)
  const { steps, current } = useStepProgress()
  const t = useT()
  return (
    <ol className="mx-auto flex h-15 min-w-0 items-stretch gap-1 overflow-x-auto" aria-label={t.header.steps}>
      {steps.map((s) => {
        const active = s.id === current
        return (
          <li key={s.id} className="flex items-stretch">
            <button
              type="button"
              onClick={() => setStep(s.id)}
              aria-current={active ? 'step' : undefined}
              className={[
                'flex items-center gap-2.5 whitespace-nowrap px-2.5 text-[15px] transition-colors sm:px-3.5',
                active ? 'font-semibold text-ink shadow-[inset_0_-2px_0_#0e0e0e]' : 'font-medium text-ink-3 hover:text-ink',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-[22px] w-[22px] items-center justify-center rounded-full font-mono text-[11px] font-semibold',
                  s.done || active ? 'bg-ink text-white' : 'border border-[#d9d9d5] text-ink-3',
                ].join(' ')}
              >
                {s.done ? <Check size={12} strokeWidth={3} /> : String(s.index + 1).padStart(2, '0')}
              </span>
              <span className={active ? '' : 'hidden sm:inline'}>{s.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
