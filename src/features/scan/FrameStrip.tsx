import { useScanStore } from '../../app/scanStore'
import type { ProjectSettings } from '../../domain/settings'

export function FrameStrip({ settings }: { settings: ProjectSettings }) {
  const outputFrames = useScanStore((s) => s.outputFrames)
  const done = Array.from({ length: settings.frameCount }, (_, i) => outputFrames.get(i + 1))
  const count = done.filter((f) => f?.source === 'scan').length
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">Frames</span>
        <span className="tabular-nums text-neutral-600">
          {count} / {settings.frameCount}
        </span>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {done.map((f, i) => (
          <div
            key={i}
            title={`#${i + 1}${f ? ` (${f.source})` : ' 未取得'}`}
            className={['aspect-video rounded-sm text-[9px] leading-none', f?.source === 'scan' ? 'bg-green-500' : f?.source === 'original' ? 'bg-amber-400' : 'bg-neutral-200'].join(' ')}
          />
        ))}
      </div>
    </div>
  )
}
