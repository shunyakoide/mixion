import { useState } from 'react'
import { useScanStore, type ResolvedFrames } from '../../app/scanStore'
import { Button } from '../../components/ui/Button'
import type { ProjectSettings } from '../../domain/settings'
import { saveBlob } from '../../lib/files'
import { encodeMp4 } from '../../lib/video/encode'
import { encodeGif } from '../../lib/video/gif'

type Busy = { kind: 'mp4' | 'gif'; done: number; total: number } | null

export function ExportPanel({ settings, resolved }: { settings: ProjectSettings; resolved: ResolvedFrames | null }) {
  const original = useScanStore((s) => s.original)
  const [withAudio, setWithAudio] = useState(true)
  const [busy, setBusy] = useState<Busy>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const audioAvailable = !!original?.info.hasAudio
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
          audioFrom: audioAvailable && withAudio ? original?.file : null,
          onProgress: (done, total) => setBusy({ kind, done, total }),
        })
        const saved = await saveBlob(r.blob, `${base}.mp4`, 'video/mp4')
        setNote(saved === 'cancelled' ? null : `MP4 を保存しました (${(r.blob.size / 1024 / 1024).toFixed(1)} MB${r.audioCopied ? '、音声あり' : r.audioNote ? `、${r.audioNote}` : ''})`)
      } else {
        const blob = await encodeGif({ frames: resolved.frames, fps: settings.fps, width: 640, onProgress: (done, total) => setBusy({ kind, done, total }) })
        const saved = await saveBlob(blob, `${base}.gif`, 'image/gif')
        setNote(saved === 'cancelled' ? null : `GIF を保存しました (${(blob.size / 1024 / 1024).toFixed(1)} MB)`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const counts = resolved ? resolved.sources.reduce<Record<string, number>>((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {}) : {}

  return (
    <div className="space-y-3">
      {resolved && (
        <div className="text-xs text-neutral-600">
          scan {counts.scan ?? 0} · original {counts.original ?? 0} · hold {counts.hold ?? 0} · blank {counts.blank ?? 0}
        </div>
      )}
      <label className={['flex items-center gap-2 text-sm', audioAvailable ? '' : 'text-neutral-400'].join(' ')}>
        <input type="checkbox" checked={withAudio && audioAvailable} disabled={!audioAvailable} onChange={(e) => setWithAudio(e.target.checked)} />
        音声を含める{audioAvailable ? '' : '（Original video が必要）'}
      </label>
      <div className="flex gap-2">
        <Button id="export-mp4" onClick={() => void run('mp4')} disabled={!resolved || busy !== null} className="flex-1">
          {busy?.kind === 'mp4' ? `MP4 ${busy.done}/${busy.total}` : 'Export MP4'}
        </Button>
        <Button id="export-gif" variant="secondary" onClick={() => void run('gif')} disabled={!resolved || busy !== null} className="flex-1">
          {busy?.kind === 'gif' ? `GIF ${busy.done}/${busy.total}` : 'Export GIF'}
        </Button>
      </div>
      {note && <p className="text-sm text-green-700">{note}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
