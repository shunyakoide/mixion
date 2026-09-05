import { useAppStore, type Step } from './store'

const STEPS: { id: Step; label: string }[] = [
  { id: 'print', label: 'Print' },
  { id: 'draw', label: 'Draw' },
  { id: 'scan', label: 'Scan' },
]

export function Steps() {
  const step = useAppStore((s) => s.step)
  const setStep = useAppStore((s) => s.setStep)
  return (
    <ol className="flex items-center gap-4 text-sm">
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setStep(s.id)}
            className={s.id === step ? 'font-medium text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}
            aria-current={s.id === step ? 'step' : undefined}
          >
            {s.label}
          </button>
          {i < STEPS.length - 1 && <span className="text-neutral-300">→</span>}
        </li>
      ))}
      <li className="flex items-center gap-4">
        <span className="text-neutral-300">→</span>
        <span className="text-neutral-400">Animate</span>
      </li>
    </ol>
  )
}
