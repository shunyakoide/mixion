# Mixion

Mixed Media Animation のための小さなウェブアプリ。
実写動画をフレームごとに紙に印刷し、手描き・コラージュで加工してスキャンし、動画に戻す制作フローの面倒な部分だけを自動化する。

**Print → Draw → Scan → Animate**

画面は Print / Scan / Animate の 3 ステップ。Draw は紙の上の工程なので、注意書きを PDF 保存後と Scan の最初に表示する。

- サーバー・データベース・アカウントなし。すべてブラウザ内で処理する
- 状態を保存しない。印刷ページの QR に設定（fps、グリッド、ページ番号、フレーム数、元動画サイズ）が入っているので、スキャン側はそれを読んで復元する
- 対応ブラウザ: Chrome / Edge（WebCodecs と保存ダイアログを使用）
- 設計書: [docs/PLAN.md](docs/PLAN.md)

## 使い方

1. **Print**: 動画をドロップ → fps とページあたりのフレーム数を選ぶ → Create Print PDF
2. **Draw（紙の上で）**: A4 に印刷して描く。四隅の ■ と QR は塗らない。ページは切らない
3. **Scan**: 300dpi でページごとにスキャン → Import Scans。QR から設定とページ番号を読み、四隅のマーカーを自動検出して切り出す。見つからない隅だけ手でクリックする
4. **Animate**: 必要なら元動画をドロップ（音声と未スキャン分の補完） → Export MP4 / GIF

## セットアップ

```bash
npm install
npm run dev
```

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 型チェック + ビルド |
| `npm test` | vitest（`tests/`） |
| `npm run lint` | oxlint |
| `npx tsx scripts/dummy-pdf.ts` | プレースホルダ画像の印刷用 PDF を `out/` に出す（印刷・スキャンの実機テスト用） |

## サンプルで試す

動画・プリンタ・スキャナがなくても一通り動かせます。

- 最初の画面の「サンプルで試す」: 同梱の 5 秒のサンプル動画（`public/sample.mp4`、カラーバーとフレームカウンター。`fixtures/sample-5s.mp4` と同じもの）を読み込み、印刷ページを画像にしてそのままスキャンとして取り込み、Animate まで進みます
- Scan の「印刷せずに取り込む」: 動画を読み込んだ後、紙に出さずに Print で作ったページを取り込みます
- `?sample` を付けて開くと、サンプル動画を読み込んだ状態で始まります

## 開発用フック（`npm run dev` のみ）

- `http://localhost:5173/?spike=video` — WebCodecs の動作確認ページ
- ブラウザコンソールの `window.__dev` — `simulateScan(page, {dpi, rotateDeg})` で印刷ページを疑似スキャン画像にする、`imageDiff`、`encodeMp4`、`encodeGif`、各ストア

## 構成

```
src/
  domain/      レイアウト(mm)・フレーム対応・ホモグラフィ・マーカー・QR設定。純粋TS、vitest対象
  features/    print / draw / scan / animate の画面とロジック
  lib/video/   WebCodecs (mediabunny) によるデコード・MP4/GIF エンコード
  workers/     ワープ処理の Web Worker
  app/         zustand ストア、ステップ表示、開発用ヘルパー
```
