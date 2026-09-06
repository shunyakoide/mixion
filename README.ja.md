# Mixion

[English](README.md)

Mixed Media Animation のための小さなウェブアプリ。
実写動画をフレームごとに紙に印刷し、手描き・コラージュで加工してスキャンし、動画に戻す制作フローの面倒な部分だけを自動化する。

**Print → Draw → Scan → Animate**

公開版: https://shunyakoide.github.io/mixion/

画面は Print / Scan / Animate の 3 ステップ。Draw は紙の上の工程なので、注意書きを PDF 保存後と Scan の最初に表示する。

- サーバー・データベース・アカウントなし。すべてブラウザ内で処理する
- 状態を保存しない。印刷ページの QR に設定（fps、グリッド、ページ番号、フレーム数、元動画サイズ）が入っているので、スキャン側はそれを読んで復元する
- 対応ブラウザ: Chrome / Edge（WebCodecs と保存ダイアログを使用）

## 使い方

1. **Print**: 動画をドロップ → fps とページあたりのフレーム数を選ぶ → Create Print PDF。縦動画は紙が縦向きになり、コマ数の選択肢も縦向きに合わせて変わる（2×2 / 3×2 / 4×2）
2. **Draw（紙の上で）**: A4 に印刷して描く。四隅のマーカーと QR は塗らない。ページは切らない
3. **Scan**: 300dpi でページごとにスキャン → Import Scans。QR から設定とページ番号を読み、四隅のマーカーを自動検出して切り出す。縦横どちらの向きで読み取ってもよい（向きは QR、QR が読めなければマーカーの解読結果から起こす。ページ番号もマーカーから分かる）。見つからない隅だけ手でクリックする。「自動検出をやり直す」と「90° 回転」のボタンもある
4. **Animate**: 必要なら元動画をドロップ（音声と未スキャン分の補完） → Export MP4 / GIF

## 言語

UI は英語がデフォルトで、ヘッダー右上のボタンで日本語に切り替えられます。選んだ言語はこのブラウザの `localStorage`（キー `mixion.locale`）に残ります。アプリがブラウザに保存するのはこれだけです。文言は `src/i18n/en.ts`（基準）と `src/i18n/ja.ts` にあり、テストで両者のキーが一致することを確認しています。

## セットアップ

Node 24 が必要です（`.node-version`）。

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

## 公開（GitHub Pages）

`.github/workflows/deploy.yml` が `main` への push ごとに `BASE_PATH=/mixion/` でビルドし、GitHub Pages に配置します（Settings → Pages の Source を「GitHub Actions」にしておく）。手元で同じビルドを確かめるには次のとおりです。

```bash
BASE_PATH=/mixion/ npm run build && npx vite preview --base /mixion/
```

## サンプルで試す

動画・プリンタ・スキャナがなくても一通り動かせます。

- 最初の画面の「サンプルで試す」: 同梱の 5 秒のサンプル動画（`public/sample.mp4`、カラーバーとフレームカウンター。`fixtures/sample-5s.mp4` と同じもの）を読み込み、印刷ページを画像にしてそのままスキャンとして取り込み、Animate まで進みます
- Scan の「印刷前に流れを確認する」（小さなリンク）: 動画を読み込んだ後、紙に出さずに Print で作ったページを取り込み、fps や配置を決めてから印刷できます
- `?sample` を付けて開くと、サンプル動画を読み込んだ状態で始まります

## 開発用フック（`npm run dev` のみ）

- `http://localhost:5173/?spike=video` — WebCodecs の動作確認ページ（本番ビルドには含まれません）
- ブラウザコンソールの `window.__dev` — `simulateScan(page, {dpi, rotateDeg})` で印刷ページを疑似スキャン画像にする、`imageDiff`、`encodeMp4`、`encodeGif`、各ストア
- `window.__timings` — 直前のスキャン取り込みの段階ごとの所要時間

## 技術構成

| 領域 | 使っているもの | 用途 |
|---|---|---|
| ビルド | Vite 8, TypeScript 6, Node 24 | 開発サーバー・型チェック・本番ビルド。`BASE_PATH` で配置先のサブパスを切り替え |
| UI | React 19, Tailwind CSS v4 | 画面。デザイントークン（色・書体・角丸・影）は `src/index.css` の `@theme` に集約 |
| 書体 | Instrument Sans, Noto Sans JP, JetBrains Mono, Space Grotesk（Google Fonts） | 本文と見出し、日本語、数値・ID・ファイル名、ロゴの語標 |
| 状態 | zustand | Print / Scan の 2 ストア。サーバーもストレージも持たない（言語設定の `localStorage` だけ例外） |
| 動画 | WebCodecs（mediabunny 経由） | ブラウザ内でのデコード（フレーム抽出）と MP4（H.264 + 元音声）のエンコード |
| GIF | gifenc | GIF 書き出し |
| PDF | pdf-lib | 印刷用 A4 PDF の生成。プレビューの canvas と同じ描画ロジックを共有 |
| マーカー・QR | 自前の ArUco（MIP_36h12）マーカー検出・解読（`src/domain/markers.ts`, `src/features/scan/detectMarkers.ts`）, jsqr, qrcode | 四隅の自動検出、向きとページ番号の復元、ページ設定の QR 埋め込みと読み取り |
| 幾何 | 自前のホモグラフィ（`src/domain/homography.ts`） | スキャン画像の歪み補正とコマの切り出し。重い処理は Web Worker |
| 検証 | zod | QR に入れた設定の検証 |
| テスト・品質 | vitest, oxlint, GitHub Actions（lint → test → build） | ドメイン層（レイアウト・マーカー・ホモグラフィ・i18n の対訳整合）の単体テスト |
| 保存 | File System Access API（`showSaveFilePicker`）、非対応時はダウンロード | PDF / MP4 / GIF の保存ダイアログ |

対応ブラウザは Chrome / Edge です。WebCodecs と保存ダイアログの両方がそろうのが現状この 2 つのためです。

## 構成

```
src/
  domain/      レイアウト(mm)・フレーム対応・ホモグラフィ・マーカー・QR設定。純粋TS、vitest対象
  features/    print / draw / scan / animate の画面とロジック
  lib/video/   WebCodecs (mediabunny) によるデコード・MP4/GIF エンコード
  workers/     ワープ処理の Web Worker
  app/         zustand ストア、ヘッダーのステッパー、下部ドック、開発用ヘルパー
  components/  Button / Chip / アイコン / ロゴ
  i18n/        en（基準）と ja の辞書、言語切り替え
```

## コントリビュート

Issue と Pull Request は日本語でも英語でも歓迎です。[CONTRIBUTING.md](CONTRIBUTING.md) を見てください。

## ライセンス

[MIT](LICENSE)
