<p align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="">
</p>

<h1 align="center">Mixion</h1>

<p align="center">
  動画のフレームを紙に印刷して、描いて、スキャンして、アニメーションに戻す。
</p>

<p align="center">
  <a href="https://shunyakoide.github.io/mixion/"><strong>アプリを開く</strong></a> ·
  <a href="README.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/shunyakoide/mixion/actions/workflows/ci.yml"><img src="https://github.com/shunyakoide/mixion/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-black" alt="MIT license"></a>
</p>

<table align="center">
  <tr>
    <td align="center"><img src="docs/images/drawn-page.jpg" width="440" alt="12 コマの動画フレームを印刷し、マーカーで描き込んだ A4 ページ"></td>
    <td align="center"><img src="docs/images/demo.gif" width="440" alt="スキャンしたページから作ったアニメーション"></td>
  </tr>
  <tr>
    <td align="center">描き込んだ後の印刷ページ</td>
    <td align="center">スキャンから作ったアニメーション</td>
  </tr>
</table>

## これは何？

Mixed Media Animation は、実写動画のコマを 1 枚ずつ紙の上で描き足したりコラージュしたりして作るアニメーションです。描くのは楽しい。でも動画をコマに分けて、印刷用に並べて、スキャンをまた切り分けて、元の順番に戻す作業は楽しくありません。

Mixion はその面倒な部分だけを引き受けます。すべてブラウザの中で動き、サーバーもアカウントもインストールも不要です。印刷した各ページには設定入りの QR コードが載っているので、スキャンの工程に必要な情報は紙そのものから読み取れます。タブを閉じて、来週スキャンを持って戻ってきても続きができます。

## 使い方

**1. Print.** 動画をドロップし、フレームレートと 1 ページあたりのコマ数を選んで PDF を保存します。縦動画は紙も縦向きになります。

<img src="docs/images/print.png" alt="Print ステップ: 読み込んだ動画、フレームレートとグリッドの選択肢、ページのプレビュー" width="800">

**2. Draw.** A4 に印刷して、コマの上に描いたり塗ったり貼ったりします。四隅のマーカーと QR コードは汚さず、ページは切り離さないでください。

**3. Scan.** ページごとにスキャン（300 dpi で十分）してファイルを取り込みます。QR から設定とページ番号を読み、四隅のマーカーを見つけてページを起こし、全コマを切り出します。傾いていても横向きでも構いません。見つからなかった隅だけクリックします。

<img src="docs/images/scan.png" alt="Scan ステップ: 取り込んだ 2 ページ、16 コマすべて切り出し済み、検出した隅とコマの枠がスキャンの上に描かれている" width="800">

**4. Animate.** 結果を再生し、必要なら元動画をドロップして音声を戻したりスキャンしなかったコマを補ったりして、MP4 か GIF で保存します。

<img src="docs/images/animate.png" alt="Animate ステップ: プレイヤー、コマの一覧、MP4 / GIF の書き出しボタン" width="800">

## 特徴

- **ブラウザから何も出ていかない。** 動画のデコード、PDF 生成、マーカー検出、MP4 エンコードをすべてローカルで行います。
- **保存するものがない。** 設定は各ページの QR コードに入っています。別のマシンでも Scan の工程から始められます。
- **スキャンはそのまま通る。** 4 つの ArUco マーカーと QR コードから、ページの位置・回転・番号を自動で復元します。スマホで撮った写真でも遠近が補正されます。
- **縦動画に対応。** 紙が縦向きになり、それに合ったグリッドを選べます。
- **元の音声付き MP4**、または GIF。
- **英語と日本語** の UI。

## プリンターなしで試す

- 最初の画面の **Try the sample** は、同梱の 5 秒のクリップを読み込み、印刷ページを画像として描画し、それをスキャンとして取り込んで Animate まで進みます。
- **Preview the flow before printing**（Scan ステップの小さなリンク）は、自分の動画を読み込んだあと、印刷せずにそのページを取り込みます。フレームレートとグリッドを先に決めるのに使えます。
- `?sample` を付けて開くと、サンプルが読み込まれた状態で始まります。

## 動作環境

- Chrome または Edge。動画に WebCodecs、保存ダイアログに File System Access API を使うため、Safari と Firefox は今のところ非対応です。
- A4 が印刷できるプリンターと、スキャナー（またはスマホのカメラ）。

## 開発

Node 24 が必要です（`.node-version`）。

```bash
npm install
npm run dev
```

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 型チェック + 本番ビルド |
| `npm test` | vitest（`tests/`） |
| `npm run lint` | oxlint |

開発時（`npm run dev`）だけ使えるフック:

- ブラウザのコンソールの `window.__dev`: `simulateScan(page, {dpi, rotateDeg})` で印刷ページを疑似スキャンとして描画。ほかに `imageDiff`、`encodeMp4`、`encodeGif`、各ストア、マーカー / QR の検出器。
- `window.__timings`: 直近のスキャン取り込みの工程別タイミング。

### デプロイ

`.github/workflows/deploy.yml` が `main` への push ごとに `BASE_PATH=/mixion/` でビルドし、GitHub Pages に公開します（Settings → Pages → Source を "GitHub Actions" にしておく必要があります）。同じビルドを手元で再現するには:

```bash
BASE_PATH=/mixion/ npm run build && npx vite preview --base /mixion/
```

## 中身

| 領域 | 使っているもの | 用途 |
|---|---|---|
| ビルド | Vite 8, TypeScript 6, Node 24 | 開発サーバー、型チェック、本番ビルド。`BASE_PATH` で配信サブパスを切り替え |
| UI | React 19, Tailwind CSS v4 | 画面。デザイントークン（色、書体、角丸、影）は `src/index.css` の `@theme` |
| 書体 | Instrument Sans, Noto Sans JP, JetBrains Mono, Space Grotesk（Google Fonts） | 本文、日本語、数字 / ID / ファイル名、ワードマーク |
| 状態 | zustand | Print と Scan の 2 ストア。言語設定以外は永続化しない |
| 動画 | WebCodecs（mediabunny 経由） | ブラウザ内デコード（フレーム抽出）と MP4 エンコード（H.264 + 元の音声） |
| GIF | gifenc | GIF 書き出し |
| PDF | pdf-lib | A4 印刷 PDF。描画ロジックは canvas プレビューと共有 |
| マーカー / QR | 自前の ArUco（MIP_36h12）検出・解読、jsqr、qrcode | 隅の検出、向きとページ番号の復元、ページ設定の埋め込みと読み取り |
| 幾何 | 自前のホモグラフィ | スキャンの補正とコマの切り出し。重い処理は Web Worker |
| 検証 | zod | QR に埋め込んだ設定 |
| 品質 | vitest, oxlint, GitHub Actions（lint → test → build） | ドメイン層のユニットテスト（レイアウト、マーカー、ホモグラフィ、i18n の整合） |
| 保存 | File System Access API（`showSaveFilePicker`）、ダウンロードへのフォールバック | PDF / MP4 / GIF の保存ダイアログ |

```
src/
  domain/      ページレイアウト（mm）、フレーム対応、ホモグラフィ、マーカー、QR 設定。純粋な TS、vitest で検証
  features/    print / scan / animate の画面とロジック
  lib/video/   WebCodecs（mediabunny）でのデコードと MP4/GIF エンコード
  workers/     ワープ用 Web Worker
  app/         zustand ストア、ヘッダーのステッパー、下部ドック、開発用ヘルパー
  components/  Button / Chip / アイコン / ロゴ
  i18n/        en（基準）と ja の辞書、言語切り替え
```

UI は英語がデフォルトで、ヘッダーから日本語に切り替えられます。選んだ言語は `localStorage` の `mixion.locale` に残ります。アプリがブラウザに保存するのはこれだけです。

## コントリビュート

Issue と Pull Request を歓迎します。英語でも日本語でも構いません。[CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT](LICENSE)
