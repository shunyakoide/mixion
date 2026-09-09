import { useMemo, useRef, useState, type DragEvent } from 'react'
import { useScanStore, type ScanItem } from '../../app/scanStore'
import { Upload, X } from '../../components/ui/icons'
import { framesPerPage } from '../../domain/frameMap'
import { useT } from '../../i18n'
import { pageDuplicates } from '../../domain/scan/duplicates'

const DOT: Record<ScanItem['status'], string> = {
  reading: 'bg-ink-3',
  detecting: 'bg-ink-3',
  needs_corners: 'bg-warn',
  ready: 'bg-ink',
  applying: 'bg-ink',
  applied: 'bg-ok',
  error: 'bg-danger',
}

/** Page order first (unknown pages last), import order within ties, so the list reads like the animation. */
function sortByPage(scans: ScanItem[]): ScanItem[] {
  return scans
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.page ?? Infinity) - (b.s.page ?? Infinity) || a.i - b.i)
    .map((x) => x.s)
}

export function ScanList() {
  const { settings, scans, selectedId, select, importScans, importing, importError, removeScan, clearScans, outputFrames, skippedDuplicates, dismissSkipped } = useScanStore()
  const duplicates = useMemo(() => (settings ? pageDuplicates(scans, outputFrames, framesPerPage(settings.grid)) : new Map()), [settings, scans, outputFrames])
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const t = useT()

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length) void importScans(files)
  }

  return (
    <div className="flex h-full flex-col gap-3" onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <button
        type="button"
        id="import-scans"
        onClick={() => inputRef.current?.click()}
        disabled={importing}
        className={[
          'flex h-11 items-center justify-center gap-2 rounded-full border border-dashed bg-white text-sm font-medium transition-colors disabled:opacity-35',
          over ? 'border-ink' : 'border-[#c9c9c5] hover:border-ink-3',
        ].join(' ')}
      >
        <Upload size={16} />
        {importing ? t.scan.importing : t.scan.addScans}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) void importScans(files)
          e.target.value = ''
        }}
      />
      {importError && <p className="text-sm text-danger">{importError}</p>}
      {skippedDuplicates.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-warn/10 py-2 pl-3 pr-1 text-xs text-ink-2" role="status">
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-ink">{t.scan.duplicateSkipped(skippedDuplicates.length)}</span>
            {skippedDuplicates.map((d, i) => (
              <span key={i} className="block truncate" title={`${d.name} — ${t.scan.duplicateSameAs(d.sameAs)}`}>
                {d.name} · {t.scan.duplicateSameAs(d.sameAs)}
              </span>
            ))}
          </span>
          <button type="button" aria-label={t.common.close} onClick={dismissSkipped} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full opacity-50 hover:opacity-100">
            <X size={12} />
          </button>
        </div>
      )}
      <ul className={['flex min-h-40 flex-1 flex-col gap-1 overflow-auto rounded-2xl transition-shadow', over ? 'shadow-[inset_0_0_0_2px_#0e0e0e]' : ''].join(' ')}>
        {scans.length === 0 && <li className="p-3 text-sm text-ink-3">{t.scan.dropScans}</li>}
        {sortByPage(scans).map((s) => {
          const active = s.id === selectedId
          const dup = duplicates.get(s.id)
          return (
            <li key={s.id} className="relative">
              <button
                type="button"
                onClick={() => select(s.id)}
                aria-current={active ? 'true' : undefined}
                className={['flex w-full items-center gap-3 rounded-xl py-2.5 pl-3 pr-9 text-left text-sm transition-colors', active ? 'bg-ink text-white' : 'hover:bg-surface'].join(' ')}
              >
                <img src={s.url} alt="" className="h-[26px] w-9 shrink-0 rounded bg-rule-3 object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" title={s.name}>
                    {s.page !== null ? `P${s.page} · ` : ''}
                    {s.name}
                  </span>
                  <span className="block text-xs leading-4">
                    <span className="opacity-70">{t.scan.status[s.status]}</span>
                    {dup && (
                      <span className={['font-medium', active ? 'text-white' : 'text-warn'].join(' ')}>
                        {' · '}
                        {t.scan.duplicatePage} · {dup.inUse ? t.scan.duplicateInUse : t.scan.duplicateUnused}
                      </span>
                    )}
                  </span>
                </span>
                <span className={['h-2 w-2 shrink-0 rounded-full', active ? 'bg-white' : dup && !dup.inUse ? 'bg-warn' : DOT[s.status]].join(' ')} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t.scan.remove}
                onClick={() => removeScan(s.id)}
                className={['absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full opacity-50 transition-opacity hover:opacity-100', active ? 'text-white' : 'text-ink'].join(' ')}
              >
                <X size={14} />
              </button>
            </li>
          )
        })}
      </ul>
      {scans.length > 0 && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t.scan.confirmRestart)) clearScans()
          }}
          disabled={importing}
          className="self-start py-2 text-[13px] text-ink-2 underline underline-offset-2 hover:text-ink disabled:opacity-35"
        >
          {t.scan.restart}
        </button>
      )}
    </div>
  )
}
