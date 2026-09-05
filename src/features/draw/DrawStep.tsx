import { useAppStore } from '../../app/store'
import { Button } from '../../components/ui/Button'

const ITEMS = [
  'PDF を A4 に印刷する。拡大縮小は「用紙に合わせる」でも構わない（マーカーから位置を復元するため）',
  '四隅の ■ マーカーと QR コードの上は塗らない・貼らない。塗ってしまっても四隅を手で指定すれば復元できる',
  '画像の外にはみ出して描いてよい。四隅の短い線（クロップ枠）の外側は動画に入らない',
  'ページは切り離さない。ページ単位でスキャンする',
  '厚みのあるコラージュはフラットベッドスキャナで。スマホ撮影でも位置は補正できる',
  'スキャン設定: 300dpi、カラー、JPEG か PNG、1 ページ 1 ファイル',
]

export function DrawStep() {
  const setStep = useAppStore((s) => s.setStep)
  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-lg font-semibold">Draw</h2>
      <ul className="space-y-3">
        {ITEMS.map((t) => (
          <li key={t} className="flex gap-3 text-sm">
            <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-neutral-400" aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <Button onClick={() => setStep('scan')}>Next: Scan →</Button>
    </div>
  )
}
