import { useState } from 'react'
import { useScanStore, type ResolvedFrames } from '../../app/scanStore'
import { Button } from '../../components/ui/Button'
import type { ProjectSettings } from '../../domain/settings'
import { saveBlob } from '../../lib/files'
import { encodeMp4 } from '../../lib/video/encode'
import { encodeGif } from '../../lib/video/gif'
import { useT } from '../../i18n'

type Busy = { kind: 'mp4' | 'gif'; done: number; total: number } | null

export function ExportPanel({ settings, resolved }: { settings: ProjectSettings; resolved: ResolvedFrames | null }) {
  const original = useScanStore((s) => s.original)
  const markExported = useScanStore((s) => s.markExported)
  const [withAudio, setWithAudio] = useState(true)
  const [busy, setBusy] = useState<Busy>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const audioAvailable = !!original?.info.hasAudio
  const audioOn = withAudio && audioAvailable
  const t = useT()
  const base = `mixion-${settings.projectId}-${settings.fps}fps`

  const run = async (kind: 'mp4' | 'gif') => {
    if (!resolved) return
    setError(null)
    setNote(null)
    setBusy({ kind, done: 0, total: resolved.frames.length })
    try {
      if (kind === 'mp4') {
        const r = await encodeMp4({
          frames: resolved.frames,
          fps: settings.fps,
          width: settings.dims.width,
          height: settings.dims.height,
          audioFrom: audioOn ? original?.file : null,
          onProgress: (done, total) => setBusy({ kind, done, total }),
        })
        const saved = await saveBlob(r.blob, `${base}.mp4`, 'video/mp4')
        if (saved !== 'cancelled') markExported('mp4', `${base}.mp4`)
        setNote(saved === 'cancelled' ? null : t.animate.savedMp4((r.blob.size / 1024 / 1024).toFixed(1), r.audioCopied ? t.common.withAudio : r.audioNote))
      } else {
        const blob = await encodeGif({ frames: resolved.frames, fps: settings.fps, width: 640, onProgress: (done, total) => setBusy({ kind, done, total }) })
        const saved = await saveBlob(blob, `${base}.gif`, 'image/gif')
        if (saved !== 'cancelled') markExported('gif', `${base}.gif`)
        setNote(saved === 'cancelled' ? null : t.animate.savedGif((blob.size / 1024 / 1024).toFixed(1)))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <span id="audio-label" className={['text-sm', audioAvailable ? 'text-ink' : 'text-ink-3'].join(' ')}>
          {t.animate.includeAudio}
        </span>
        <span className="flex items-center gap-2 text-xs text-ink-3">
          {!audioAvailable && <span>{t.animate.needsOriginal}</span>}
          <button
            type="button"
            role="switch"
            aria-checked={audioOn}
            aria-labelledby="audio-label"
            disabled={!audioAvailable}
            onClick={() => setWithAudio((v) => !v)}
            className={['relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 disabled:cursor-not-allowed', audioOn ? 'bg-ink' : 'bg-rule-3'].join(' ')}
          >
            <span className={['absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-[left] duration-150', audioOn ? 'left-[19px]' : 'left-[3px]'].join(' ')} />
          </button>
        </span>
      </div>
      <Button id="export-mp4" size="lg" onClick={() => void run('mp4')} disabled={!resolved || busy !== null}>
        {busy?.kind === 'mp4' ? `MP4 ${busy.done}/${busy.total}` : t.animate.exportMp4}
      </Button>
      <Button id="export-gif" size="lg" variant="secondary" onClick={() => void run('gif')} disabled={!resolved || busy !== null}>
        {busy?.kind === 'gif' ? (
          `GIF ${busy.done}/${busy.total}`
        ) : (
          <>
            {t.animate.exportGif}
            <span className="text-[13px] font-normal text-ink-3">{t.animate.gifSize}</span>
          </>
        )}
      </Button>
      <p className="text-center font-mono text-xs text-ink-3">{base}.mp4</p>
      {note && <p className="text-[13px] text-ink-2">{note}</p>}
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  )
}
