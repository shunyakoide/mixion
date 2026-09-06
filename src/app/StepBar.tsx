import { Button } from '../components/ui/Button'
import { ChevronLeft, ChevronRight } from '../components/ui/icons'
import { STEP_ORDER, useAppStore } from './store'
import { useStepProgress } from './useStepProgress'

/** Fixed bottom bar: where you are, what is missing, and the way forward. */
export function StepBar() {
  const setStep = useAppStore((s) => s.setStep)
  const { steps, currentIndex } = useStepProgress()
  const info = steps[currentIndex]
  const prev = STEP_ORDER[currentIndex - 1]
  const next = STEP_ORDER[currentIndex + 1]
  const nextInfo = next ? steps[currentIndex + 1] : null

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-panel/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:gap-4 sm:px-6 sm:py-3 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-medium">
            {currentIndex + 1} / {steps.length} {info.label}
          </span>
          <span className="ml-3 hidden text-ink-2 md:inline">{info.hint}</span>
        </div>
        {prev && (
          <Button variant="secondary" onClick={() => setStep(prev)} aria-label={`前へ: ${steps[currentIndex - 1].label}`} className="px-3 sm:px-4">
            <ChevronLeft className="sm:-ml-1 sm:mr-1" />
            <span className="hidden sm:inline">{steps[currentIndex - 1].label}</span>
          </Button>
        )}
        {nextInfo && (
          <Button variant={info.done ? 'primary' : 'secondary'} onClick={() => setStep(nextInfo.id)} id="step-next">
            次へ: {nextInfo.label}
            <ChevronRight className="-mr-1 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
