/**
 * AbortSignal helpers shared by the stores: a signal that follows several
 * others, and the two lines every long run needs to tell a cancel from a
 * failure.
 */

/**
 * A signal that aborts as soon as any of `signals` does. `AbortSignal.any`
 * where the browser has it (Chrome 116, Safari 17.4); linked by hand elsewhere,
 * because the app promises Chrome 94 and Safari 16.4.
 */
export function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([...signals])
  return linkSignals(signals)
}

/** The hand-linked version of `anySignal`, on its own so it can be tested where the native one exists. */
export function linkSignals(signals: readonly AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      break
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}

/** True for the rejection an aborted signal produces, so callers can stay quiet about it. */
export function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
}
