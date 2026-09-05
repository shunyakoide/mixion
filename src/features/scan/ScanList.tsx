import { useRef, useState, type DragEvent } from 'react'
import { useScanStore, type ScanItem } from '../../app/scanStore'
import { Button } from '../../components/ui/Button'

const STATUS_LABEL: Record<ScanItem['status'], { text: string; cls: string }> = {
  reading: { text: '読み込み中', cls: 'text-ink-3' },
  needs_corners: { text: '未指定', cls: 'text-warn' },
  ready: { text: 'Apply 待ち', cls: 'text-accent' },
  applying: { text: '処理中…', cls: 'text-accent' },
  applied: { text: 'OK', cls: 'text-ok' },
  error: { text: 'エラー', cls: 'text-danger' },
}

export function ScanList() {
  const { scans, selectedId, select, importScans, importing, importError, removeScan } = useScanStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length) void importScans(files)
  }

  return (
    <div className="flex h-full flex-col gap-3" onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <Button id="import-scans" onClick={() => inputRef.current?.click()} disabled={importing} className="w-full">
        {importing ? '読み込み中…' : 'Import Scans'}
      </Button>
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
      <ul className={['min-h-40 flex-1 space-y-1 overflow-auto rounded-lg border p-1', over ? 'border-ink bg-rule/40' : 'border-rule bg-panel'].join(' ')}>
        {scans.length === 0 && <li className="p-3 text-sm text-ink-3">スキャン画像をここにドロップ</li>}
        {scans.map((s) => {
          const st = STATUS_LABEL[s.status]
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => select(s.id)}
                className={['flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm', s.id === selectedId ? 'bg-ink text-white' : 'hover:bg-rule/40'].join(' ')}
              >
                <span className="w-7 shrink-0 tabular-nums opacity-70">{s.page !== null ? `P${s.page}` : '—'}</span>
                <span className="min-w-0 flex-1 truncate" title={s.name}>
                  {s.name}
                </span>
                <span className={[s.id === selectedId ? 'text-white/80' : st.cls, 'shrink-0 text-xs'].join(' ')}>{st.text}</span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="remove"
                  onClick={(e) => { e.stopPropagation(); removeScan(s.id) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removeScan(s.id) } }}
                  className="shrink-0 px-1 opacity-50 hover:opacity-100"
                >
                  ×
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
