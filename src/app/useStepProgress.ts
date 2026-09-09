import { useAnimateStore } from './animateStore'
import { useScanStore } from './scanStore'
import { STEP_ORDER, useAppStore, type Step } from './store'
import { useT } from '../i18n'

export interface StepInfo {
  id: Step
  index: number
  label: string
  done: boolean
  /** False when the step has nothing to show yet; `lockedHint` says what unlocks it. */
  enabled: boolean
  lockedHint?: string
}

/**
 * Print and Scan are always open: a video is optional (the QR code carries the
 * settings), so Scan is a legitimate starting point. Animate needs at least one
 * cut frame, otherwise there is nothing to play.
 */
export function useStepProgress(): { steps: StepInfo[]; current: Step; currentIndex: number } {
  const current = useAppStore((s) => s.step)
  const printDone = useAppStore((s) => s.status === 'done')
  const applied = useScanStore((s) => s.outputFrames.size)
  const exported = useAnimateStore((s) => s.exported)
  const t = useT()

  const steps: StepInfo[] = [
    { id: 'print', index: 0, label: t.steps.print, done: printDone, enabled: true },
    { id: 'scan', index: 1, label: t.steps.scan, done: applied > 0, enabled: true },
    {
      id: 'animate',
      index: 2,
      label: t.steps.animate,
      done: exported.mp4 !== null || exported.gif !== null,
      enabled: applied > 0,
      lockedHint: applied > 0 ? undefined : t.steps.animateLocked,
    },
  ]
  return { steps, current, currentIndex: STEP_ORDER.indexOf(current) }
}
