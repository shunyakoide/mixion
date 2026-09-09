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
  const { info, fps, gridKey, projectId, status, progress, pdfError, lastSaved, savedKind, createPdf, createPngPages, cancelPrint, setStep, file } = useAppStore()
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
      <div className="mx-auto max-w-2xl pt-4 sm:pt-8">
        <h1 className="text-[32px] font-semibold leading-9 tracking-[-0.03em]">{t.print.title}</h1>
        <p className="mt-3 max-w-[60ch] text-sm leading-[22px] text-ink-2">{t.print.intro}</p>
        <div className="mt-8">
          <VideoDrop />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col rounded-[20px] bg-surface p-5">
            <div className="text-[15px] font-semibold">{t.print.haveDrawnTitle}</div>
            <div className="mt-1 flex-1 text-sm leading-[22px] text-ink-2">{t.print.haveDrawnBody}</div>
            <Button variant="secondary" className="mt-4 self-start" onClick={() => setStep('scan')}>
              <Scan size={16} /> {t.print.importScans}
            </Button>
          </div>
          <div className="flex flex-col rounded-[20px] bg-surface p-5">
            <div className="text-[15px] font-semibold">{t.print.tryTitle}</div>
            <div className="mt-1 flex-1 text-sm leading-[22px] text-ink-2">{t.print.tryBody}</div>
            <Button variant="secondary" className="mt-4 self-start" onClick={() => void runDemo()} disabled={demo.running}>
              {demo.running ? (
                <>
                  <Spinner /> {demo.label}
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
    <div className="grid items-start gap-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-10">
      <div className="flex flex-col gap-8 lg:sticky lg:top-[84px] lg:gap-9">
        <div>
          <h1 className="text-[32px] font-semibold leading-9 tracking-[-0.03em]">{t.print.loadedTitle}</h1>
          <p className="mt-2.5 text-sm leading-[22px] text-ink-2">{t.print.loadedIntro}</p>
        </div>
        <VideoDrop />
        <SettingsPanel />
        <div className="flex flex-col gap-2.5">
          <Button id="create-pdf" size="lg" onClick={() => void createPdf()} disabled={!settings || busy} className="w-full">
            {busy ? (
              <>
                <Spinner /> {progress?.label ?? t.print.saving}
              </>
            ) : (
              <>
                {status === 'done' && savedKind === 'pdf' ? t.print.savePdfAgain : t.print.savePdf}
                <ArrowRight size={16} />
              </>
            )}
          </Button>
          {busy && progress ? (
            <div className="flex items-center gap-3">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-rule-3" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
                <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${(100 * progress.done) / Math.max(1, progress.total)}%` }} />
              </div>
              <button type="button" onClick={cancelPrint} className="shrink-0 text-[13px] leading-[18px] text-ink-2 underline underline-offset-2 hover:text-ink">
                {t.common.cancel}
              </button>
            </div>
          ) : (
            <p className="text-center text-xs leading-[18px] text-ink-3">{t.print.afterSave}</p>
          )}
          {pdfError && <p className="text-sm text-danger">{pdfError}</p>}
          <button
            type="button"
            className="mt-1 self-center py-1 text-center text-[13px] leading-[18px] text-ink-2 underline underline-offset-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
            onClick={() => void createPngPages()}
            disabled={!settings || busy}
          >
            {t.print.savePng}
          </button>
          {!(status === 'done' && lastSaved) && (
            <button
              type="button"
              className="self-center py-1 text-center text-[13px] leading-[18px] text-ink-2 underline underline-offset-2 hover:text-ink"
              onClick={() => setStep('scan')}
            >
              {t.print.goScanEarly}
            </button>
          )}
        </div>

        {status === 'done' && lastSaved && (
          <div className="rounded-[20px] bg-surface p-5" aria-live="polite">
            <div className="flex items-center gap-2 font-semibold">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                <Check size={12} strokeWidth={3} />
              </span>
              <span className="truncate">{t.print.saved(lastSaved)}</span>
            </div>
            <div className="mt-4 text-[13px] font-semibold tracking-[0.02em]">{savedKind === 'png' ? t.print.whenDigital : t.print.whenDrawing}</div>
            <ul className="mt-2 space-y-1.5 text-sm leading-[22px] text-ink-2">
              {(savedKind === 'png' ? t.print.digitalNotes : t.print.drawNotes).map((note) => (
                <li key={note} className="flex gap-2">
                  <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-ink-3" aria-hidden />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            <Button className="mt-5 w-full" onClick={() => setStep('scan')}>
              {t.print.goScan} <ArrowRight size={16} />
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
