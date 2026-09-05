import { useScanStore } from './scanStore'
import { STEP_ORDER, useAppStore, type Step } from './store'

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

  const steps: StepInfo[] = [
    {
      id: 'print',
      index: 0,
      label: 'Print',
      done: printDone,
      hint: printDone ? 'PDF を保存しました' : hasVideo ? 'Create Print PDF で印刷用 PDF を保存します' : '動画を読み込むと PDF を作れます',
    },
    {
      id: 'scan',
      index: 1,
      label: 'Scan',
      done: applied > 0,
      hint:
        applied > 0
          ? `${applied}${settings ? ` / ${settings.frameCount}` : ''} フレームを切り出しました`
          : scansImported > 0
            ? '見つからなかった隅をクリックして Apply します'
            : 'スキャンした画像を取り込みます',
    },
    {
      id: 'animate',
      index: 2,
      label: 'Animate',
      done: exported.mp4 !== null || exported.gif !== null,
      hint: exported.mp4 || exported.gif ? '書き出しました' : applied > 0 ? 'MP4 か GIF に書き出します' : 'Scan でフレームを切り出すと書き出せます',
    },
  ]
  return { steps, current, currentIndex: STEP_ORDER.indexOf(current) }
}
