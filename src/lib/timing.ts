/**
 * Dev-only stopwatch. Laps are collected on `window.__timings` so the import
 * pipeline can be profiled from the console; a no-op in production builds.
 */
type Lap = [label: string, ms: number]

const enabled = import.meta.env.DEV && typeof window !== 'undefined'

export function stopwatch(name: string): (label: string) => void {
  if (!enabled) return () => {}
  const laps: Lap[] = []
  let last = performance.now()
  const w = window as unknown as { __timings?: Record<string, Lap[]>[] }
  ;(w.__timings ??= []).push({ [name]: laps })
  return (label) => {
    const now = performance.now()
    laps.push([label, Math.round(now - last)])
    last = now
  }
}
