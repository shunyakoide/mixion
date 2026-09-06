import { Check } from '../components/ui/icons'
import { useAppStore } from './store'
import { useStepProgress } from './useStepProgress'

export function Steps() {
  const setStep = useAppStore((s) => s.setStep)
  const { steps, current } = useStepProgress()
  return (
    <ol className="flex min-w-0 items-stretch gap-1 overflow-x-auto" aria-label="手順">
      {steps.map((s) => {
        const active = s.id === current
        return (
          <li key={s.id} className="flex items-center">
            <button
              type="button"
              onClick={() => setStep(s.id)}
              aria-current={active ? 'step' : undefined}
              className={[
                'flex min-h-11 items-center gap-2 rounded-md px-2 text-sm transition-colors sm:min-h-9 sm:px-3',
                active ? 'bg-ink text-white' : 'text-ink-2 hover:bg-rule/60',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold',
                  s.done ? 'bg-ok text-white' : active ? 'bg-panel text-ink' : 'border border-rule-2 text-ink-3',
                ].join(' ')}
              >
                {s.done ? <Check size={12} strokeWidth={3} /> : s.index + 1}
              </span>
              <span className={[active ? 'font-medium' : 'hidden sm:inline'].join(' ')}>{s.label}</span>
            </button>
            {s.index < steps.length - 1 && <span className="mx-0.5 h-px w-2 bg-rule-2 sm:mx-1 sm:w-5" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}
