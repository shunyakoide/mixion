import { useEffect } from 'react'
import { loadSampleVideo, runDemo, useDemoStore } from '../../app/demo'
import { deriveSettings, useAppStore } from '../../app/store'
import { Button } from '../../components/ui/Button'
import { ArrowRight, Check, Scan, Spinner } from '../../components/ui/icons'
import { useT } from '../../i18n'
import { PagePreview } from './PagePreview'
import { SettingsPanel } from './SettingsPanel'
import { VideoDrop } from './VideoDrop'

export function PrintStep() {
  const { info, fps, gridKey, projectId, status, progress, pdfError, lastSaved, createPdf, setStep, file } = useAppStore()
  const demo = useDemoStore()
  const t = useT()
  const settings = deriveSettings({ info, fps, gridKey, projectId })
  const busy = status === 'extracting' || status === 'building' || status === 'saving'

  // ?sample opens the app with the sample clip already loaded.
  useEffect(() => {
    if (file || !new URLSearchParams(location.search).has('sample')) return
    void loadSampleVideo().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!file) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <h1 className="text-2xl font-semibold tracking-tight">{t.print.title}</h1>
        <p className="mt-2 max-w-prose text-ink-2">
          {t.print.intro}
        </p>
        <div className="mt-8">
          <VideoDrop />
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col rounded-lg border border-rule bg-panel p-4">
            <div className="font-medium">{t.print.haveDrawnTitle}</div>
            <div className="mt-0.5 flex-1 text-sm text-ink-2">{t.print.haveDrawnBody}</div>
            <Button variant="secondary" className="mt-4 self-start" onClick={() => setStep('scan')}>
              <Scan size={16} className="mr-2" /> {t.print.importScans}
            </Button>
          </div>
          <div className="flex flex-col rounded-lg border border-rule bg-panel p-4">
            <div className="font-medium">{t.print.tryTitle}</div>
            <div className="mt-0.5 flex-1 text-sm text-ink-2">{t.print.tryBody}</div>
            <Button variant="secondary" className="mt-4 self-start" onClick={() => void runDemo()} disabled={demo.running}>
              {demo.running ? (
                <>
                  <Spinner className="mr-2" /> {demo.label}
                </>
              ) : (
                t.print.trySample
              )}
            </Button>
            {demo.error && <p className="mt-2 text-sm text-danger">{demo.error}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)] xl:gap-12">
      <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <VideoDrop />
        <SettingsPanel />
        <div className="space-y-3">
          <Button id="create-pdf" onClick={() => void createPdf()} disabled={!settings || busy} className="w-full">
            {busy ? (
              <>
                <Spinner className="mr-2" /> {progress?.label ?? t.print.saving}
              </>
            ) : status === 'done' ? (
              t.print.savePdfAgain
            ) : (
              t.print.savePdf
            )}
          </Button>
          {busy && progress && (
            <div className="h-1.5 w-full overflow-hidden rounded bg-rule" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
              <div className="h-full bg-accent transition-[width]" style={{ width: `${(100 * progress.done) / Math.max(1, progress.total)}%` }} />
            </div>
          )}
          {pdfError && <p className="text-sm text-danger">{pdfError}</p>}
        </div>

        {status === 'done' && lastSaved && (
          <div className="rounded-lg border border-ok/30 bg-ok-soft p-4" aria-live="polite">
            <div className="flex items-center gap-2 font-medium text-ok">
              <Check /> {t.print.saved(lastSaved)}
            </div>
            <div className="mt-3 text-sm font-medium">{t.print.whenDrawing}</div>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
              {t.print.drawNotes.map((note) => (
                <li key={note} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-3" aria-hidden />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            <Button className="mt-4" onClick={() => setStep('scan')}>
              {t.print.goScan} <ArrowRight className="ml-1" />
            </Button>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <PagePreview />
      </div>
    </div>
  )
}
