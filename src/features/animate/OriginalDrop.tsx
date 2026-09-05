import { useRef, useState, type DragEvent } from 'react'
import { useScanStore } from '../../app/scanStore'
import { firstFileFromDrop, isVideoFile } from '../../lib/files'

/** Optional: the source video, for audio and for frames that were not scanned. */
export function OriginalDrop() {
  const { original, originalLoading, originalError, loadOriginal, clearOriginal } = useScanStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOver(false)
    const f = firstFileFromDrop(e, isVideoFile)
    if (f) void loadOriginal(f)
  }

  if (original) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-rule bg-panel px-3 py-2 text-sm">
        <span className="text-ink-2">Original</span>
        <span className="truncate font-medium" title={original.file.name}>
          {original.file.name}
        </span>
        <span className="text-ink-2">{original.info.hasAudio ? '音声あり' : '音声なし'}</span>
        <button type="button" onClick={clearOriginal} className="ml-auto text-ink-2 hover:text-ink">
          ×
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      className={['cursor-pointer rounded-lg border border-dashed px-3 py-2 text-sm', over ? 'border-ink bg-rule/40' : 'border-rule-2 bg-panel text-ink-2 hover:border-ink-3'].join(' ')}
    >
      {originalLoading ? '読み込み中…' : originalError ? <span className="text-danger">{originalError}</span> : 'Original video（任意: 音声と未スキャン分の補完に使用）'}
      <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadOriginal(f); e.target.value = '' }} />
    </div>
  )
}
