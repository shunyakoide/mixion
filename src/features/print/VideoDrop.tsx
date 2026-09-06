import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useAppStore } from '../../app/store'
import { Button } from '../../components/ui/Button'
import { Spinner, Upload } from '../../components/ui/icons'
import { firstFileFromDrop, formatBytes, isVideoFile } from '../../lib/files'
import { useObjectUrl } from '../../lib/useObjectUrls'
import { useT } from '../../i18n'

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

/** The first frame of the loaded file: the extracted frame once the preview has it, a muted video element until then. */
function Thumb({ file }: { file: File }) {
  const first = useAppStore((s) => s.frames.get(1) ?? null)
  const url = useObjectUrl(first ?? file)
  const cls = 'aspect-video w-[72px] shrink-0 rounded-lg bg-rule-3 object-cover'
  if (!url) return <div className={cls} aria-hidden />
  if (first) return <img src={url} alt="" className={cls} />
  // Nudging currentTime makes Chrome paint the first frame instead of leaving the element blank.
  return <video src={url} muted playsInline preload="metadata" onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.001 }} className={cls} aria-hidden />
}

export function VideoDrop() {
  const { file, info, probing, loadError, loadVideo } = useAppStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const t = useT()
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
          `${info.duration.toFixed(2)}s`,
          ...(info.frameRate ? [`${Math.round(info.frameRate * 100) / 100}fps`] : []),
          formatBytes(file.size).replace(' ', ''),
        ]
      : []
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={['flex items-center gap-3.5 rounded-2xl bg-surface p-3 transition-shadow', dragging ? 'shadow-[inset_0_0_0_2px_#0e0e0e]' : ''].join(' ')}
      >
        <Thumb file={file} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold" title={file.name}>
            {file.name}
          </div>
          <div className="font-mono text-xs leading-[18px] text-ink-2">
            {probing ? (
              <span className="flex items-center gap-2">
                <Spinner size={12} /> {t.common.loading}
              </span>
            ) : loadError ? (
              <span className="text-danger">{loadError}</span>
            ) : (
              meta.join(' · ')
            )}
          </div>
        </div>
        <Button variant="secondary" size="sm" className="border-0 shadow-small" onClick={() => inputRef.current?.click()} disabled={probing} title={t.videoDrop.dropAnywhere}>
          {dragging ? t.videoDrop.dropToReplace : t.print.replace}
        </Button>
        {input}
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={[
        'flex min-h-[300px] flex-col items-center justify-center rounded-3xl bg-surface px-6 py-12 text-center transition-shadow',
        dragging ? 'shadow-[inset_0_0_0_2px_#0e0e0e]' : '',
      ].join(' ')}
    >
      <Upload size={28} className="text-ink-3" />
      <div className="mt-4 text-lg font-semibold">{dragging ? t.videoDrop.dropToLoad : t.videoDrop.dropVideo}</div>
      <div className="mt-1 text-sm text-ink-2">{t.videoDrop.formats}</div>
      <Button size="lg" className="mt-6 min-w-48" onClick={() => inputRef.current?.click()}>
        {t.common.chooseFile}
      </Button>
      {input}
    </div>
  )
}
