import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useAppStore } from '../../app/store'
import { Button } from '../../components/ui/Button'
import { Film, Spinner, Upload } from '../../components/ui/icons'
import { firstFileFromDrop, formatBytes, isVideoFile } from '../../lib/files'

/** Page-wide drag target: while a file is dragged anywhere over the window, show where to drop it. */
function usePageDrop(enabled: boolean, onFile: (f: File) => void) {
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let depth = 0
    const enter = (e: globalThis.DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      depth++
      setDragging(true)
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const over = (e: globalThis.DragEvent) => e.preventDefault()
    const drop = (e: globalThis.DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragging(false)
      const f = firstFileFromDrop(e, isVideoFile)
      if (f) onFile(f)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [enabled, onFile])
  return dragging
}

export function VideoDrop() {
  const { file, info, probing, loadError, loadVideo } = useAppStore()
  const inputRef = useRef<HTMLInputElement>(null)
  // Dropping a video anywhere on the page loads it, and replaces the current one if there is one.
  const dragging = usePageDrop(true, loadVideo)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const f = firstFileFromDrop(e, isVideoFile)
    if (f) void loadVideo(f)
  }

  const input = (
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
  )

  if (file) {
    const meta: string[] = info
      ? [
          `${info.width}×${info.height}`,
          `${info.duration.toFixed(2)} 秒`,
          ...(info.frameRate ? [`${Math.round(info.frameRate * 100) / 100} fps`] : []),
          formatBytes(file.size),
          info.hasAudio ? '音声あり' : '音声なし',
        ]
      : []
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={['rounded-lg border p-4 transition-colors', dragging ? 'border-accent bg-accent-soft' : 'border-rule bg-panel'].join(' ')}
      >
        <div className="flex items-start gap-3">
          <Film size={20} className="mt-0.5 shrink-0 text-ink-3" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium" title={file.name}>
              {file.name}
            </div>
            <div className="mt-1 text-sm text-ink-2">
              {probing && (
                <span className="flex items-center gap-2">
                  <Spinner size={14} /> 読み込み中…
                </span>
              )}
              {loadError && <span className="text-danger">{loadError}</span>}
              {info && (
                <ul className="flex flex-wrap gap-x-2 gap-y-0.5">
                  {meta.map((m, i) => (
                    <li key={m} className="whitespace-nowrap">
                      {i > 0 && <span className="mr-2 text-ink-3" aria-hidden>·</span>}
                      {m}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <Button variant="secondary" className="mt-4 w-full" onClick={() => inputRef.current?.click()} disabled={probing}>
          <Upload size={16} className="mr-2" />
          {dragging ? 'ここに離すと差し替えます' : '別の動画を選ぶ'}
        </Button>
        <p className="mt-2 text-center text-xs text-ink-3">ページのどこにドロップしても差し替わります</p>
        {input}
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={[
        'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors sm:px-6 sm:py-16',
        dragging ? 'border-accent bg-accent-soft' : 'border-rule-2 bg-panel',
      ].join(' ')}
    >
      <Upload size={28} className={dragging ? 'text-accent' : 'text-ink-3'} />
      <div className="mt-4 text-lg font-medium">{dragging ? 'ここに離すと読み込みます' : '動画をここにドロップ'}</div>
      <div className="mt-1 text-sm text-ink-2">mp4 / mov / webm。ファイルはこのブラウザの中だけで処理されます</div>
      <Button className="mt-6" onClick={() => inputRef.current?.click()}>
        ファイルを選ぶ
      </Button>
      {input}
    </div>
  )
}
