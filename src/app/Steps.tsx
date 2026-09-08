import { useEffect, useRef } from 'react'
import { Check } from '../components/ui/icons'
import { useAppStore } from './store'
import { useStepProgress } from './useStepProgress'
import { useT } from '../i18n'

/** Header stepper: a numbered badge per step, the current one underlined across the header's full height. On phones the labels give way to the badges. */
export function Steps() {
  const setStep = useAppStore((s) => s.setStep)
  const { steps, current } = useStepProgress()
  const t = useT()
  const list = useRef<HTMLOListElement>(null)
  // On a narrow screen the list can still overflow; keep the current step in view rather than hidden off the edge.
  useEffect(() => {
    const ol = list.current
    const active = ol?.querySelector<HTMLElement>('[aria-current]')
    if (!ol || !active) return
    const left = active.offsetLeft
    const right = left + active.offsetWidth
    if (left < ol.scrollLeft) ol.scrollLeft = left
    else if (right > ol.scrollLeft + ol.clientWidth) ol.scrollLeft = right - ol.clientWidth
  }, [current])
  return (
    <ol ref={list} className="@container flex h-15 min-w-0 flex-1 items-stretch justify-center gap-1 overflow-x-auto [scrollbar-width:none]" aria-label={t.header.steps}>
      {steps.map((s) => {
        const active = s.id === current
        return (
          <li key={s.id} className="flex items-stretch">
            <button
              type="button"
              onClick={() => setStep(s.id)}
              disabled={!s.enabled}
              title={s.lockedHint}
              aria-current={active ? 'step' : undefined}
              className={[
                'flex items-center gap-2 whitespace-nowrap px-2 text-[15px] transition-colors sm:gap-2.5 sm:px-3.5',
                active
                  ? 'font-semibold text-ink shadow-[inset_0_-2px_0_#0e0e0e]'
                  : s.enabled
                    ? 'font-medium text-ink-3 hover:text-ink'
                    : 'cursor-not-allowed font-medium text-ink-3/50',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-[22px] w-[22px] items-center justify-center rounded-full font-mono text-[11px] font-semibold',
                  s.done || active ? 'bg-ink text-white' : 'border border-[#d9d9d5] text-ink-3',
                ].join(' ')}
              >
                {s.done ? <Check size={12} strokeWidth={3} /> : String(s.index + 1).padStart(2, '0')}
              </span>
              {/* Inactive labels need a wide screen; the current one shows whenever the list has room for it (about 13rem). */}
              <span className={active ? 'hidden @min-[13rem]:inline sm:inline' : 'hidden sm:inline'}>{s.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
