import { useRef, useState, type DragEvent } from 'react'
import { runScanWithoutPaper, useDemoStore } from '../../app/demo'
import { useScanStore } from '../../app/scanStore'
import { useAppStore } from '../../app/store'
import { Button } from '../../components/ui/Button'
import { Scan, Spinner } from '../../components/ui/icons'
import { DRAW_NOTES } from '../print/drawNotes'
import { SettingsBar } from './SettingsBar'

/** First screen of Scan: one big drop target and the three things that happen next. */
export function ScanEmpty() {
  const { importScans, importing, importError } = useScanStore()
  const hasVideo = useAppStore((s) => s.info !== null)
  const demo = useDemoStore()
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
      <h1 className="text-2xl font-semibold tracking-tight">描いたページを取り込む</h1>
      <p className="mt-2 max-w-prose text-ink-2">1 ページ 1 ファイルでスキャンした画像（JPEG / PNG）を入れてください。QR と四隅のマーカーを読み取って、自動でコマに切り出します。QR やマーカーが隠れているページだけ、その場で指定をお願いします。</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={['mt-8 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors', over ? 'border-accent bg-accent-soft' : 'border-rule-2 bg-panel'].join(' ')}
      >
        {importing ? <Spinner size={28} className="text-accent" /> : <Scan size={28} className={over ? 'text-accent' : 'text-ink-3'} />}
        <div className="mt-4 text-lg font-medium">{over ? 'ここに離すと取り込みます' : 'スキャン画像をここにドロップ'}</div>
        <div className="mt-1 text-sm text-ink-2">複数ファイルをまとめて入れられます。順番は QR で判定します</div>
        <Button className="mt-6" onClick={() => inputRef.current?.click()} disabled={importing}>
          ファイルを選ぶ
        </Button>
        <input ref={inputRef} type="file" accept="image/*,.jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) void importScans(files); e.target.value = '' }} />
        {importError && <p className="mt-3 text-sm text-danger">{importError}</p>}
      </div>

      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ['取り込む', 'ページごとの画像をまとめて入れる'],
          ['自動で切り出し', 'QR と四隅の ■ を読み取って、コマを元の順番に並べる'],
          ['確認', '緑の枠がずれていないか見て、Animate へ'],
        ].map(([t, d], i) => (
          <li key={t} className="rounded-lg border border-rule bg-panel p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-rule-2 text-[11px] text-ink-3">{i + 1}</span>
              {t}
            </div>
            <div className="mt-1 text-sm text-ink-2">{d}</div>
          </li>
        ))}
      </ol>

      {hasVideo && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-panel p-4">
          <div>
            <div className="font-medium">印刷した紙がなくても試せます</div>
            <div className="mt-0.5 text-sm text-ink-2">Print で作ったページをそのまま画像にして取り込みます。</div>
          </div>
          <Button variant="secondary" onClick={() => void runScanWithoutPaper()} disabled={demo.running || importing}>
            {demo.running ? (
              <>
                <Spinner className="mr-2" /> {demo.label}
              </>
            ) : (
              '印刷せずに取り込む'
            )}
          </Button>
          {demo.error && <p className="w-full text-sm text-danger">{demo.error}</p>}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <button type="button" className="text-ink-2 underline underline-offset-2 hover:text-ink" onClick={() => setShowNotes((v) => !v)}>
          {showNotes ? '描くときの注意を閉じる' : '描くときの注意を見る'}
        </button>
        <button type="button" className="text-ink-2 underline underline-offset-2 hover:text-ink" onClick={() => setManual((v) => !v)}>
          {manual ? '閉じる' : 'QR が読めない場合: 設定を手で入力する'}
        </button>
      </div>
      {showNotes && (
        <ul className="mt-3 space-y-1.5 text-sm text-ink-2">
          {DRAW_NOTES.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-3" aria-hidden />
              <span>{t}</span>
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
