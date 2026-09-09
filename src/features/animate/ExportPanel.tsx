import { useState, type ReactNode } from 'react'
import { useExportStore } from '../../app/exportStore'
import { useScanStore, type ResolvedFrames } from '../../app/scanStore'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { gifWidthOptions, MP4_QUALITIES, mp4Bitrate, outputDims, resolveGifWidth, resolveSize, sizeOptionsFor } from '../../domain/exportOptions'
import type { ProjectSettings } from '../../domain/settings'
import { saveBlob } from '../../lib/files'
import { encodeMp4 } from '../../lib/video/encode'
import { encodeGif } from '../../lib/video/gif'
import { describeAudioNote, describeError, useT } from '../../i18n'

type Busy = { kind: 'mp4' | 'gif'; done: number; total: number } | null

function OptionRow({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold tracking-[0.02em]">{label}</span>
        {note && <span className="font-mono text-xs text-ink-3">{note}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

export function ExportPanel({ settings, resolved }: { settings: ProjectSettings; resolved: ResolvedFrames | null }) {
  const original = useScanStore((s) => s.original)
  const markExported = useScanStore((s) => s.markExported)
  const options = useExportStore()
  const [withAudio, setWithAudio] = useState(true)
  const [busy, setBusy] = useState<Busy>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const audioAvailable = !!original?.info.hasAudio
  const audioOn = withAudio && audioAvailable
  const t = useT()

  // The stored choices are checked against this source: a 720p clip cannot be exported at 1080p.
  const sizes = sizeOptionsFor(settings.dims)
  const size = resolveSize(settings.dims, options.size)
  const dims = outputDims(settings.dims, size)
  const gifWidths = gifWidthOptions(dims)
  const gifWidth = resolveGifWidth(dims, options.gifWidth)
  const bitrate = mp4Bitrate(dims, options.quality)
  const base = `mixion-${settings.projectId}-${settings.fps}fps${size === 'source' ? '' : `-${size}p`}`

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
          width: dims.width,
          height: dims.height,
          bitrate,
          audioFrom: audioOn ? original?.file : null,
          onProgress: (done, total) => setBusy({ kind, done, total }),
        })
        const saved = await saveBlob(r.blob, `${base}.mp4`, 'video/mp4')
        if (saved !== 'cancelled') markExported('mp4', `${base}.mp4`)
        setNote(saved === 'cancelled' ? null : t.animate.savedMp4((r.blob.size / 1024 / 1024).toFixed(1), r.audioCopied ? t.common.withAudio : r.audioNote ? describeAudioNote(r.audioNote, t) : null))
      } else {
        const blob = await encodeGif({ frames: resolved.frames, fps: settings.fps, width: gifWidth, onProgress: (done, total) => setBusy({ kind, done, total }) })
        const saved = await saveBlob(blob, `${base}.gif`, 'image/gif')
        if (saved !== 'cancelled') markExported('gif', `${base}.gif`)
        setNote(saved === 'cancelled' ? null : t.animate.savedGif((blob.size / 1024 / 1024).toFixed(1)))
      }
    } catch (e) {
      setError(describeError(e, t))
    } finally {
      setBusy(null)
    }
  }

  const locked = busy !== null

  return (
    <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-5">
      <div className="mb-1 flex flex-col gap-4">
        <OptionRow label={t.animate.exportSize} note={`${dims.width}×${dims.height}`}>
          {sizes.map((o) => (
            <Chip key={o.choice} size="sm" tone="panel" selected={size === o.choice} onClick={() => options.update({ size: o.choice })} disabled={locked}>
              {o.choice === 'source' ? t.animate.sourceSize : t.animate.sizeLabel(o.choice)}
            </Chip>
          ))}
        </OptionRow>
        <OptionRow label={t.animate.mp4Quality} note={t.animate.qualityNote((bitrate / 1e6).toFixed(bitrate % 1e6 ? 1 : 0))}>
          {MP4_QUALITIES.map((q) => (
            <Chip key={q} size="sm" tone="panel" selected={options.quality === q} onClick={() => options.update({ quality: q })} disabled={locked}>
              {t.animate.quality[q]}
            </Chip>
          ))}
        </OptionRow>
        <OptionRow label={t.animate.gifWidth}>
          {gifWidths.map((w) => (
            <Chip key={w} size="sm" tone="panel" selected={gifWidth === w} onClick={() => options.update({ gifWidth: w })} disabled={locked}>
              {w}px
            </Chip>
          ))}
        </OptionRow>
      </div>
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
      <Button id="export-mp4" size="lg" onClick={() => void run('mp4')} disabled={!resolved || locked}>
        {busy?.kind === 'mp4' ? `MP4 ${busy.done}/${busy.total}` : t.animate.exportMp4}
      </Button>
      <Button id="export-gif" size="lg" variant="secondary" onClick={() => void run('gif')} disabled={!resolved || locked}>
        {busy?.kind === 'gif' ? (
          `GIF ${busy.done}/${busy.total}`
        ) : (
          <>
            {t.animate.exportGif}
            <span className="text-[13px] font-normal text-ink-3">{t.animate.gifSize(gifWidth)}</span>
          </>
        )}
      </Button>
      <p className="text-center font-mono text-xs text-ink-3">{base}.mp4</p>
      {note && <p className="text-[13px] text-ink-2">{note}</p>}
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  )
}
