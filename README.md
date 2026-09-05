# Mixion

Mixed Media Animation のための小さなウェブアプリ。
実写動画をフレームごとに紙に印刷し、手描き・コラージュで加工してスキャンし、動画に戻す制作フローの面倒な部分だけを自動化する。

**Print → Draw → Scan → Animate**

- サーバー・データベース・アカウントなし。すべてブラウザ内で処理する
- 対応ブラウザ: まず Chrome / Edge
- 設計書: [docs/PLAN.md](docs/PLAN.md)

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
| `npm test` | vitest（`tests/` と `src/**/*.test.ts`） |
| `npm run lint` | oxlint |
