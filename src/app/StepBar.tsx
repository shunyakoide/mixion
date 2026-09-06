import { ChevronLeft, ChevronRight } from '../components/ui/icons'
import { STEP_ORDER, useAppStore } from './store'
import { useStepProgress } from './useStepProgress'
import { useT } from '../i18n'

/** Floating dock at the bottom: where you are, what is left to do here, and the way forward. */
export function StepBar() {
  const setStep = useAppStore((s) => s.setStep)
  const { steps, currentIndex } = useStepProgress()
  const t = useT()
  const info = steps[currentIndex]
  const prev = STEP_ORDER[currentIndex - 1]
  const nextInfo = STEP_ORDER[currentIndex + 1] ? steps[currentIndex + 1] : null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex h-14 max-w-full items-center gap-1.5 rounded-full bg-ink px-1.5 text-white shadow-dock">
        {prev && (
          <button
            type="button"
            onClick={() => setStep(prev)}
            aria-label={t.steps.back(steps[currentIndex - 1].label)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 hover:bg-white/12"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <div className={['min-w-0 pr-3 text-[13px] leading-[18px]', prev ? 'pl-1' : 'pl-3.5'].join(' ')}>
          <div className="whitespace-nowrap font-semibold">
            {currentIndex + 1} / {steps.length} · {info.label}
          </div>
          <div className="hidden truncate text-white/60 md:block">{info.hint}</div>
        </div>
        {nextInfo ? (
          <button
            type="button"
            onClick={() => setStep(nextInfo.id)}
            id="step-next"
            className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white pl-[18px] pr-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface"
          >
            {t.steps.next(nextInfo.label)}
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ink text-white">
              <ChevronRight size={14} strokeWidth={2.5} />
            </span>
          </button>
        ) : (
          <span className="w-2" aria-hidden />
        )}
      </div>
    </div>
  )
}
