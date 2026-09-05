import { useRef, useState, type DragEvent } from 'react'
import { useAppStore } from '../../app/store'
import { firstFileFromDrop, formatBytes, isVideoFile } from '../../lib/files'

export function VideoDrop() {
  const { file, info, probing, loadError, loadVideo, clearVideo } = useAppStore()
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const f = firstFileFromDrop(e, isVideoFile)
    if (f) void loadVideo(f)
  }

  if (file) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-medium" title={file.name}>
              {file.name}
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              {probing && '読み込み中…'}
              {loadError && <span className="text-red-600">{loadError}</span>}
              {info && (
                <>
                  {info.width}×{info.height} · {info.duration.toFixed(2)}s
                  {info.frameRate ? ` · ${Math.round(info.frameRate * 100) / 100}fps` : ''} · {formatBytes(file.size)} ·{' '}
                  {info.hasAudio ? '音声あり' : '音声なし'}
                </>
              )}
            </div>
          </div>
          <button type="button" onClick={clearVideo} className="shrink-0 text-sm text-neutral-500 hover:text-neutral-900">
            変更
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      className={[
        'flex h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors',
        over ? 'border-neutral-900 bg-neutral-100' : 'border-neutral-300 bg-white hover:border-neutral-500',
      ].join(' ')}
    >
      <div className="text-base font-medium">Drop Video Here</div>
      <div className="mt-1 text-sm text-neutral-500">またはクリックして選択（mp4 / mov / webm）</div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mp4,.mov,.m4v,.webm"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void loadVideo(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
