# Contributing

Thanks for your interest in Mixion. Issues and pull requests are welcome, in English or Japanese.

## Reporting a problem

Scans are where most things go wrong. When a page does not import cleanly, please include:

- the browser and its version (Chrome and Edge are supported)
- the scanner or phone used, the scan resolution, and whether the page was fed portrait or landscape
- the scanned image itself if you can share it, or a note on which corners were not found
- what the app said (the status under the page thumbnail, and any message in the corner picker)

For anything else, the steps you took and what you expected are enough.

## Working on the code

```bash
npm install
npm run dev
npm test
npm run lint
```

Node 24 is required (see `.node-version`). CI runs lint, tests and a production build on every pull request.

A few conventions:

- `src/domain/` is pure TypeScript with no DOM dependencies and is covered by unit tests in `tests/`. Layout, marker, homography and QR changes belong there, with a test.
- UI strings live in `src/i18n/en.ts` (source of truth) and `src/i18n/ja.ts`. Add every new key to both; a test fails when they drift.
- Design tokens (colours, type, radius, shadows) are in `@theme` in `src/index.css`. Prefer them over raw values in components.
- Nothing may be uploaded or stored. The only browser storage is the locale preference.
- The printed page layout is versioned (`LAYOUT_VERSION` in `src/domain/layout.ts`, `QR_VERSION` in `src/domain/settings.ts`). A change that moves markers, cells or the QR, or alters the QR payload, needs a version bump so old printouts are recognised as such.

You can exercise the whole pipeline without a printer: use **Try the sample** on the first screen, or in the dev console call `window.__dev.simulateScan(page, { dpi, rotateDeg })` to make a fake scan from the current print settings.

## Pull requests

- Keep a pull request to one change. Small ones are reviewed quickly.
- Run `npm test` and `npm run lint` before opening it.
- Describe what changed and why, and how you checked it (real scans, the sample, or a simulated scan).
