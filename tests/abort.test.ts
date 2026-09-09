import { describe, expect, it } from 'vitest'
import { anySignal, isAbort, linkSignals, throwIfAborted } from '../src/lib/abort'

describe('linkSignals', () => {
  it('aborts with the first of its signals, carrying the reason', () => {
    const a = new AbortController()
    const b = new AbortController()
    const linked = linkSignals([a.signal, b.signal])
    expect(linked.aborted).toBe(false)
    b.abort('stop')
    expect(linked.aborted).toBe(true)
    expect(linked.reason).toBe('stop')
  })
  it('is aborted from the start when one of its signals already is', () => {
    const a = new AbortController()
    a.abort()
    expect(linkSignals([new AbortController().signal, a.signal]).aborted).toBe(true)
  })
  it('behaves like the native version', () => {
    const a = new AbortController()
    const native = anySignal([a.signal])
    const linked = linkSignals([a.signal])
    a.abort()
    expect([native.aborted, linked.aborted]).toEqual([true, true])
  })
})

describe('isAbort and throwIfAborted', () => {
  it('tell an abort from a failure', () => {
    const c = new AbortController()
    expect(() => throwIfAborted(c.signal)).not.toThrow()
    expect(() => throwIfAborted(undefined)).not.toThrow()
    c.abort()
    let caught: unknown
    try {
      throwIfAborted(c.signal)
    } catch (e) {
      caught = e
    }
    expect(isAbort(caught)).toBe(true)
    expect(isAbort(new Error('aborted'))).toBe(false)
  })
})
