import { useEffect } from 'react'
import { loadSampleVideo, runDemo, useDemoStore } from '../../app/demo'
import { deriveSettings, useAppStore } from '../../app/store'
import { Button } from '../../components/ui/Button'
import { ArrowRight, Check, Spinner } from '../../components/ui/icons'
import { DRAW_NOTES } from './drawNotes'
import { PagePreview } from './PagePreview'
import { SettingsPanel } from './SettingsPanel'
import { VideoDrop } from './VideoDrop'

export function PrintStep() {
  const { info, fps, gridKey, projectId, status, progress, pdfError, lastSaved, createPdf, setStep, file } = useAppStore()
  const demo = useDemoStore()
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
        <h1 className="text-2xl font-semibold tracking-tight">動画を紙に印刷して、描いて、動画に戻す</h1>
        <p className="mt-2 max-w-prose text-ink-2">
          動画をコマに分けて A4 に並べた PDF を作ります。印刷して手を加え、スキャンして取り込むと、元の順番の動画に戻ります。
        </p>
        <div className="mt-8">
          <VideoDrop />
        </div>
        <div className="mt-8 rounded-lg border border-rule bg-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">動画がなくても試せます</div>
              <div className="mt-0.5 text-sm text-ink-2">5 秒のサンプル動画を読み込み、印刷ページをそのままスキャンとして取り込んで、アニメーションまで進みます。</div>
            </div>
            <Button variant="secondary" onClick={() => void runDemo()} disabled={demo.running}>
              {demo.running ? (
                <>
                  <Spinner className="mr-2" /> {demo.label}
                </>
              ) : (
                'サンプルで試す'
              )}
            </Button>
          </div>
          {demo.error && <p className="mt-2 text-sm text-danger">{demo.error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr] xl:gap-12">
      <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <VideoDrop />
        <SettingsPanel />
        <div className="space-y-3">
          <Button id="create-pdf" onClick={() => void createPdf()} disabled={!settings || busy} className="w-full">
            {busy ? (
              <>
                <Spinner className="mr-2" /> {progress?.label ?? '保存中…'}
              </>
            ) : status === 'done' ? (
              'もう一度 PDF を保存する'
            ) : (
              '印刷用 PDF を保存する'
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
              <Check /> 保存しました: {lastSaved}
            </div>
            <div className="mt-3 text-sm font-medium">印刷して描くときに</div>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
              {DRAW_NOTES.map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-3" aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <Button className="mt-4" onClick={() => setStep('scan')}>
              描いたページをスキャンして取り込む <ArrowRight className="ml-1" />
            </Button>
          </div>
        )}
      </div>
      <PagePreview />
    </div>
  )
}
