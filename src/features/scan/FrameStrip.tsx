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
        <span className="tabular-nums text-ink-2">
          {count} / {settings.frameCount}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-2">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-ok" aria-hidden /> スキャンから</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-warn" aria-hidden /> 元動画で補完</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rule" aria-hidden /> 未取得</span>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {done.map((f, i) => (
          <div
            key={i}
            title={`#${i + 1}${f ? ` (${f.source})` : ' 未取得'}`}
            className={['aspect-video rounded-sm text-[9px] leading-none', f?.source === 'scan' ? 'bg-ok' : f?.source === 'original' ? 'bg-warn' : 'bg-rule'].join(' ')}
          />
        ))}
      </div>
    </div>
  )
}
