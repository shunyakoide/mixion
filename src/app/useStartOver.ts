import { useScanStore } from './scanStore'
import { useAppStore } from './store'
import { startOver } from './demo'
import { useT } from '../i18n'

/** Back to the start page. Real work is only dropped after a confirmation; the sample goes straight back. */
export function useStartOver(): () => void {
  const sample = useAppStore((s) => s.sample)
  const hasVideo = useAppStore((s) => s.file !== null)
  const hasScans = useScanStore((s) => s.scans.length > 0)
  const t = useT()
  return () => {
    if (!sample && (hasVideo || hasScans) && !window.confirm(t.header.startOverConfirm)) return
    startOver()
  }
}
