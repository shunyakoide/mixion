import { useScanStore } from './scanStore'
import { STEP_ORDER, useAppStore, type Step } from './store'
import { useT } from '../i18n'

export interface StepInfo {
  id: Step
  index: number
  label: string
  done: boolean
  /** One line telling the user what is missing before this step counts as done. */
  hint: string
}

export function useStepProgress(): { steps: StepInfo[]; current: Step; currentIndex: number } {
  const current = useAppStore((s) => s.step)
  const hasVideo = useAppStore((s) => s.file !== null)
  const printDone = useAppStore((s) => s.status === 'done')
  const scansImported = useScanStore((s) => s.scans.length)
  const applied = useScanStore((s) => s.outputFrames.size)
  const settings = useScanStore((s) => s.settings)
  const exported = useScanStore((s) => s.exported)
  const t = useT()

  const steps: StepInfo[] = [
    {
      id: 'print',
      index: 0,
      label: t.steps.print,
      done: printDone,
      hint: printDone ? t.steps.hintPrintDone : hasVideo ? t.steps.hintPrintHasVideo : t.steps.hintPrintNoVideo,
    },
    {
      id: 'scan',
      index: 1,
      label: t.steps.scan,
      done: applied > 0,
      hint:
        applied > 0
          ? t.steps.hintScanApplied(applied, settings ? settings.frameCount : null)
          : scansImported > 0
            ? t.steps.hintScanImported
            : t.steps.hintScanEmpty,
    },
    {
      id: 'animate',
      index: 2,
      label: t.steps.animate,
      done: exported.mp4 !== null || exported.gif !== null,
      hint: exported.mp4 || exported.gif ? t.steps.hintAnimateExported : applied > 0 ? t.steps.hintAnimateReady : t.steps.hintAnimateEmpty,
    },
  ]
  return { steps, current, currentIndex: STEP_ORDER.indexOf(current) }
}
