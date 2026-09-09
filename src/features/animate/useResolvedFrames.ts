import { useEffect, useState } from 'react'
import { useAnimateStore, type ResolvedFrames } from '../../app/animateStore'
import { useScanStore } from '../../app/scanStore'
import { isAbort } from '../../lib/abort'

type Deps = readonly [unknown, unknown, unknown]

/**
 * Resolved frame list, recomputed when the cut frames, the original or the
 * settings change. A resolve still taking frames from the original is stopped
 * when any of them changes or the screen goes away.
 */
export function useResolvedFrames(): { resolved: ResolvedFrames | null; loading: boolean } {
  const outputFrames = useScanStore((s) => s.outputFrames)
  const settings = useScanStore((s) => s.settings)
  const original = useAnimateStore((s) => s.original)
  const resolveFrames = useAnimateStore((s) => s.resolveFrames)
  const [state, setState] = useState<{ resolved: ResolvedFrames | null; deps: Deps } | null>(null)

  const deps: Deps = [outputFrames, original, settings]
  const fresh = state !== null && state.deps[0] === deps[0] && state.deps[1] === deps[1] && state.deps[2] === deps[2]

  useEffect(() => {
    if (!settings) return
    const controller = new AbortController()
    void resolveFrames(settings, outputFrames, { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setState({ resolved: r, deps: [outputFrames, original, settings] })
      })
      .catch((e: unknown) => {
        // A fill the store stopped (original cleared or replaced) is followed by a new resolve; keep the old frames until then.
        if (!controller.signal.aborted && !isAbort(e)) setState({ resolved: null, deps: [outputFrames, original, settings] })
      })
    return () => controller.abort()
  }, [outputFrames, original, settings, resolveFrames])

  return { resolved: state?.resolved ?? null, loading: !!settings && !fresh }
}
