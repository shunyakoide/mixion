import { useEffect } from 'react'
import { useScanStore } from './scanStore'
import { useAppStore } from './store'

/** Warn before leaving when there is work that would be lost (nothing is persisted by design). */
export function useUnloadGuard() {
  const hasVideo = useAppStore((s) => s.file !== null)
  const hasScans = useScanStore((s) => s.scans.length > 0)
  useEffect(() => {
    if (!hasVideo && !hasScans) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasVideo, hasScans])
}
