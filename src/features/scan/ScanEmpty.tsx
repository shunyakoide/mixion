import { useRef, useState, type DragEvent } from 'react'
import { runScanWithoutPaper, useDemoStore } from '../../app/demo'
import { useScanStore } from '../../app/scanStore'
import { useAppStore } from '../../app/store'
import { Button } from '../../components/ui/Button'
import { Scan, Spinner } from '../../components/ui/icons'
import { useT } from '../../i18n'
import { SettingsBar } from './SettingsBar'

/** First screen of Scan: one big drop target and the three things that happen next. */
export function ScanEmpty() {
  const { importScans, importing, importError } = useScanStore()
  const hasVideo = useAppStore((s) => s.info !== null)
  const demo = useDemoStore()
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [manual, setManual] = useState(false)
  const link = 'py-1 text-[13px] text-ink-2 underline underline-offset-2 hover:text-ink'

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length) void importScans(files)
  }

  return (
    <div className="mx-auto max-w-2xl pt-4 sm:pt-8">
      <h1 className="text-[32px] font-semibold leading-9 tracking-[-0.03em]">{t.scan.emptyTitle}</h1>
      <p className="mt-3 max-w-[60ch] text-pretty text-sm leading-[22px] text-ink-2">{t.scan.emptyIntro}</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={['mt-8 flex min-h-[300px] flex-col items-center justify-center rounded-3xl bg-surface px-6 py-12 text-center transition-shadow', over ? 'shadow-[inset_0_0_0_2px_#0e0e0e]' : ''].join(' ')}
      >
        {importing ? <Spinner size={28} className="text-ink-3" /> : <Scan size={28} className="text-ink-3" />}
        <div className="mt-4 text-lg font-semibold">{over ? t.scan.dropToImport : t.scan.dropScans}</div>
        <div className="mt-1 text-sm text-ink-2">{t.scan.multipleFiles}</div>
        <Button size="lg" className="mt-6 min-w-48" onClick={() => inputRef.current?.click()} disabled={importing}>
          {t.common.chooseFile}
        </Button>
        <input ref={inputRef} type="file" accept="image/*,.jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) void importScans(files); e.target.value = '' }} />
        {importError && <p className="mt-3 text-sm text-danger">{importError}</p>}
      </div>

      <ol className="mt-6 grid gap-4 sm:grid-cols-3">
        {t.scan.howSteps.map(([title, d], i) => (
          <li key={title} className="rounded-[20px] bg-surface p-5">
            <div className="flex items-center gap-2.5 text-sm font-semibold">
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[#d9d9d5] font-mono text-[11px] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
              {title}
            </div>
            <div className="mt-1.5 text-sm leading-[22px] text-ink-2">{d}</div>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
        <button type="button" className={link} onClick={() => setShowNotes((v) => !v)}>
          {showNotes ? t.scan.hideNotes : t.scan.showNotes}
        </button>
        <button type="button" className={link} onClick={() => setManual((v) => !v)}>
          {manual ? t.common.close : t.scan.manualOpen}
        </button>
        {hasVideo && (
          <button type="button" className={`flex items-center gap-2 ${link} disabled:no-underline disabled:opacity-70`} onClick={() => void runScanWithoutPaper()} disabled={demo.running || importing}>
            {demo.running ? (
              <>
                <Spinner size={14} /> {demo.label}
              </>
            ) : (
              t.scan.tryWithoutPaper
            )}
          </button>
        )}
      </div>
      {demo.error && <p className="mt-2 text-sm text-danger">{demo.error}</p>}
      {showNotes && (
        <ul className="mt-3 space-y-1.5 text-sm leading-[22px] text-ink-2">
          {t.print.drawNotes.map((note) => (
            <li key={note} className="flex gap-2">
              <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-ink-3" aria-hidden />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}
      {manual && (
        <div className="mt-3">
          <SettingsBar />
        </div>
      )}
    </div>
  )
}
