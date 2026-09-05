import { useEffect, useState } from 'react'
import { useScanStore, type ResolvedFrames } from '../../app/scanStore'

type Deps = readonly [unknown, unknown, unknown]

/** Resolved frame list, recomputed when scans or the original change. */
export function useResolvedFrames(): { resolved: ResolvedFrames | null; loading: boolean } {
  const outputFrames = useScanStore((s) => s.outputFrames)
  const original = useScanStore((s) => s.original)
  const settings = useScanStore((s) => s.settings)
  const resolveFrames = useScanStore((s) => s.resolveFrames)
  const [state, setState] = useState<{ resolved: ResolvedFrames | null; deps: Deps } | null>(null)

  const deps: Deps = [outputFrames, original, settings]
  const fresh = state !== null && state.deps[0] === deps[0] && state.deps[1] === deps[1] && state.deps[2] === deps[2]

  useEffect(() => {
    if (!settings) return
    let cancelled = false
    void resolveFrames()
      .then((r) => {
        if (!cancelled) setState({ resolved: r, deps: [outputFrames, original, settings] })
      })
      .catch(() => {
        if (!cancelled) setState({ resolved: null, deps: [outputFrames, original, settings] })
      })
    return () => {
      cancelled = true
    }
  }, [outputFrames, original, settings, resolveFrames])

  return { resolved: state?.resolved ?? null, loading: !!settings && !fresh }
}
