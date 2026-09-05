import { useEffect } from 'react'
import { deriveSettings, useAppStore } from '../../app/store'
import { Button } from '../../components/ui/Button'
import { PagePreview } from './PagePreview'
import { SettingsPanel } from './SettingsPanel'
import { VideoDrop } from './VideoDrop'

export function PrintStep() {
  const { info, fps, gridKey, projectId, status, progress, pdfError, lastSaved, createPdf, setStep, loadVideo, file } = useAppStore()
  const settings = deriveSettings({ info, fps, gridKey, projectId })
  const busy = status === 'extracting' || status === 'building' || status === 'saving'

  // Dev convenience: ?sample loads the bundled fixture.
  useEffect(() => {
    if (!import.meta.env.DEV || file || !new URLSearchParams(location.search).has('sample')) return
    const url = new URL('../../../fixtures/sample-5s.mp4', import.meta.url).href
    void fetch(url)
      .then((r) => r.blob())
      .then((b) => loadVideo(new File([b], 'sample-5s.mp4', { type: 'video/mp4' })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <VideoDrop />
        <SettingsPanel />
        <div className="space-y-2">
          <Button id="create-pdf" onClick={() => void createPdf()} disabled={!settings || busy} className="w-full">
            {busy ? progress?.label ?? '保存中…' : 'Create Print PDF'}
          </Button>
          {busy && progress && (
            <div className="h-1.5 w-full overflow-hidden rounded bg-neutral-200" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
              <div className="h-full bg-neutral-900 transition-[width]" style={{ width: `${(100 * progress.done) / Math.max(1, progress.total)}%` }} />
            </div>
          )}
          {pdfError && <p className="text-sm text-red-600">{pdfError}</p>}
          {status === 'done' && lastSaved && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
              <div>保存しました: {lastSaved}</div>
              <button type="button" onClick={() => setStep('draw')} className="mt-1 underline">
                次へ: 印刷して描く →
              </button>
            </div>
          )}
        </div>
      </div>
      <PagePreview />
    </div>
  )
}
