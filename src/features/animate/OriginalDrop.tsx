import { useRef, useState, type DragEvent } from 'react'
import { useAnimateStore } from '../../app/animateStore'
import { Film, Spinner, X } from '../../components/ui/icons'
import { firstFileFromDrop, isVideoFile } from '../../lib/files'
import { useT } from '../../i18n'

/** Optional: the source video, for audio and for frames that were not scanned. */
export function OriginalDrop() {
  const { original, originalLoading, originalError, filling, loadOriginal, clearOriginal } = useAnimateStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const t = useT()

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOver(false)
    const f = firstFileFromDrop(e, isVideoFile)
    if (f) void loadOriginal(f)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold tracking-[0.02em]">{t.animate.originalOptional}</span>
      {original ? (
        <div className="flex h-14 items-center gap-3 rounded-[14px] border border-rule-2 bg-white pl-3.5 pr-1.5">
          <Film size={18} className="shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium" title={original.file.name}>
              {original.file.name}
            </span>
            <span className="block font-mono text-xs leading-4 text-ink-2">{filling ? t.animate.filling(filling.done, filling.total) : !original.info.canDecodeVideo ? t.animate.audioOnly : original.info.hasAudio ? t.common.withAudio : t.common.noAudio}</span>
          </span>
          <button type="button" onClick={clearOriginal} aria-label={t.common.clear} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface hover:text-ink">
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={[
            'flex min-h-14 w-full items-center gap-3 rounded-[14px] border border-dashed bg-white px-3.5 py-2 text-left text-[13px] leading-[18px] text-ink-2 transition-colors',
            over ? 'border-ink' : 'border-[#c9c9c5] hover:border-ink-3',
          ].join(' ')}
        >
          {originalLoading ? <Spinner size={18} className="shrink-0 text-ink-3" /> : <Film size={18} className="shrink-0 text-ink-3" />}
          <span>{originalLoading ? t.common.loading : originalError ? <span className="text-danger">{originalError}</span> : t.animate.originalDrop}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadOriginal(f); e.target.value = '' }} />
    </div>
  )
}
