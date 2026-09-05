export type Step = 'print' | 'draw' | 'scan' | 'animate'

const STEPS: { id: Step; label: string }[] = [
  { id: 'print', label: 'Print' },
  { id: 'draw', label: 'Draw' },
  { id: 'scan', label: 'Scan' },
  { id: 'animate', label: 'Animate' },
]

export function Steps({ current }: { current: Step }) {
  return (
    <ol className="flex items-center gap-4 text-sm">
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex items-center gap-4">
          <span className={s.id === current ? 'font-medium text-neutral-900' : 'text-neutral-400'}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span className="text-neutral-300">→</span>}
        </li>
      ))}
    </ol>
  )
}
