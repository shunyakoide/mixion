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

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length) void importScans(files)
  }

  return (
    <div className="mx-auto max-w-2xl pt-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t.scan.emptyTitle}</h1>
      <p className="mt-2 max-w-prose text-ink-2">{t.scan.emptyIntro}</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={['mt-8 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors sm:px-6 sm:py-16', over ? 'border-accent bg-accent-soft' : 'border-rule-2 bg-panel'].join(' ')}
      >
        {importing ? <Spinner size={28} className="text-accent" /> : <Scan size={28} className={over ? 'text-accent' : 'text-ink-3'} />}
        <div className="mt-4 text-lg font-medium">{over ? t.scan.dropToImport : t.scan.dropScans}</div>
        <div className="mt-1 text-sm text-ink-2">{t.scan.multipleFiles}</div>
        <Button className="mt-6" onClick={() => inputRef.current?.click()} disabled={importing}>
          {t.common.chooseFile}
        </Button>
        <input ref={inputRef} type="file" accept="image/*,.jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) void importScans(files); e.target.value = '' }} />
        {importError && <p className="mt-3 text-sm text-danger">{importError}</p>}
      </div>

      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {t.scan.howSteps.map(([title, d], i) => (
          <li key={title} className="rounded-lg border border-rule bg-panel p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-rule-2 text-[11px] text-ink-3">{i + 1}</span>
              {title}
            </div>
            <div className="mt-1 text-sm text-ink-2">{d}</div>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <button type="button" className="text-ink-2 underline underline-offset-2 hover:text-ink" onClick={() => setShowNotes((v) => !v)}>
          {showNotes ? t.scan.hideNotes : t.scan.showNotes}
        </button>
        <button type="button" className="text-ink-2 underline underline-offset-2 hover:text-ink" onClick={() => setManual((v) => !v)}>
          {manual ? t.common.close : t.scan.manualOpen}
        </button>
        {hasVideo && (
          <button type="button" className="flex items-center gap-2 text-ink-2 underline underline-offset-2 hover:text-ink disabled:no-underline disabled:opacity-70" onClick={() => void runScanWithoutPaper()} disabled={demo.running || importing}>
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
        <ul className="mt-3 space-y-1.5 text-sm text-ink-2">
          {t.print.drawNotes.map((note) => (
            <li key={note} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-3" aria-hidden />
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
