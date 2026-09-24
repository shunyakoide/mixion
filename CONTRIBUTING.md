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

- `src/domain/` is pure TypeScript with no DOM dependencies and is covered by unit tests in `tests/`. Layout, marker, homography, QR, warp and page-painting changes belong there, with a test. `src/lib/` and `src/workers/` build on it and never import from the screens or the stores, and `src/app/` (the stores) never imports from `src/features/` (the screens); the three screens do not import each other; nothing below `src/app/` imports react or zustand. `tests/layers.test.ts` checks all of that, so a new file that breaks a rule fails the build rather than the next reader.
- `tests/scanPipeline.test.ts` paints a page, scans it with rotation, margin and ink spread, and runs it through the QR read, marker detection, homography and warp, next to a real inkjet scan in `tests/fixtures/`. Before changing the QR payload, the read passes or the detector, add the case there; a pass there is what says a printed page still reads.
- UI strings live in `src/i18n/en.ts` (source of truth) and `src/i18n/ja.ts`. Add every new key to both; a test fails when they drift.
- Design tokens (colours, type, radius, shadows) are in `@theme` in `src/index.css`. Prefer them over raw values in components.
- Long work is cancellable: frame extraction, the PDF and PNG runs and the MP4/GIF encoders take an `AbortSignal`, and the stores abort it when the source changes, the user cancels, or the screen goes away. Pass the signal through when adding another long step. Combine signals with `anySignal` from `lib/abort`, not `AbortSignal.any`, which Safari before 17.4 does not have.
- Nothing may be uploaded. The only browser storage is the locale preference and the export options (size, quality, GIF width); video, frames and scans never leave memory.
- The printed page is versioned by `QR_VERSION` in `src/domain/settings.ts`. A change that moves markers, cells or the QR, or alters the QR payload, needs a version bump so old printouts are recognised as such: the scan side rebuilds the layout from the payload alone. QR payload v2 is `2/<project>/<page>/<frames>/<fps>/<grid>/<width>x<height>`; v1 was the same fields as JSON and is still read. Keep the text short: the code sits in a 16 mm square, and a 300 dpi scan of an inkjet print only decodes reliably up to about 29 modules (roughly 40 characters).

## How the code is organised

```
src/
  domain/      page layout (mm), frame mapping, homography, markers, QR settings, the page painter (what goes where on a printed page) and the QR encoder. Pure TS, covered by vitest
  domain/scan/ the pure half of the scan pipeline: QR reading, marker detection, orientation, warp, duplicate handling
  lib/         browser adapters over domain: file save (File System Access API with download fallback), store-only zip writer, image/bitmap utils, the page QR reader, error codes, feature detection, timing, frame cache
  lib/print/   the page painter's two backends (canvas, pdf-lib), the PDF builder and the page-to-PNG renderer
  lib/video/   decoding and MP4/GIF encoding on WebCodecs (mediabunny); extractMissing is the one frame-filling routine behind the preview, the print run and Animate
  workers/     the warp Web Worker and its pool
  app/         zustand stores (store = Print, scanStore = Scan, animateStore = Animate, exportStore = export options), the page-placement rules (mergePrepared), header stepper, hooks, the sample run and dev helpers
  features/    the print / scan / animate screens: React components and their hooks only
  components/  Button / Chip / icons / logo
  i18n/        en (source) and ja dictionaries, locale switch
tests/         vitest, flat, one file per source module or scenario; fixtures/ holds a real inkjet scan
```

| Area | Built with | Used for |
|---|---|---|
| Build | Vite 8, TypeScript 6, Node 24 | dev server, type check, production build; `BASE_PATH` selects the deploy sub-path |
| UI | React 19, Tailwind CSS v4 | the screens; design tokens live in `@theme` in `src/index.css` |
| Type | Instrument Sans, Noto Sans JP, JetBrains Mono, Space Grotesk (Google Fonts) | text, Japanese, numbers/IDs/file names, the wordmark |
| State | zustand | stores for Print, Scan, Animate, export options, the sample run and the locale; only the export options and the locale are persisted (localStorage) |
| Video | WebCodecs via mediabunny | in-browser decoding (frame extraction) and MP4 encoding (H.264 + original audio) |
| GIF | gifenc | GIF export |
| PDF | pdf-lib | the A4 print PDF; shares its painting logic with the canvas preview |
| Markers / QR | own ArUco (MIP_36h12) detector and decoder, jsqr, qrcode | finding the corners, recovering orientation and page number, embedding and reading the page settings |
| Geometry | own homography | straightening scans and cutting out frames; heavy work runs in Web Workers |
| Validation | zod | the settings embedded in the QR code |
| Quality | vitest, oxlint, GitHub Actions (lint → test → build) | unit tests for the domain layer (layout, markers, homography, page painter), the stores, the PDF builder, the scan pipeline end to end, i18n parity and the layer rules |
| Saving | File System Access API (`showSaveFilePicker`), download fallback | save dialogs for PDF / MP4 / GIF |

## Working without a printer

Use **Try the sample** on the first screen, or **Preview the flow before printing** on the Scan step with your own video. With `npm run dev` there are also two hooks in the browser console:

- `window.__dev`: `simulateScan(page, { dpi, rotateDeg })` renders a print page as a fake scan from the current settings; also `imageDiff`, `encodeMp4`, `encodeGif`, `deriveSettings`, the stores and the marker/QR detectors.
- `window.__timings`: per-stage timings of the last scan import.

## Deployment

The `pages` job in `.github/workflows/ci.yml` builds with `BASE_PATH=/mixion/` on every push to `main`, after lint, tests and the default build have passed, and publishes to GitHub Pages (Settings → Pages → Source must be "GitHub Actions"). To reproduce that build locally:

```bash
BASE_PATH=/mixion/ npm run build && npx vite preview --base /mixion/
```

### Cloudflare trial deployment

The Cloudflare copy runs on a `workers.dev` URL and on `mixion.shunyakoide.com` (the custom
domain in `wrangler.jsonc`'s `routes`) while GitHub Pages remains the canonical site. Only the built `dist/`
assets are uploaded; video processing and user files remain in the browser.

Use Node 24 and the repository's pinned Wrangler dependency:

```bash
npm ci
npm run lint
npm test
npm run preview:cloudflare
# After checking the local preview, authenticate and deploy:
npx wrangler login
npm run deploy:cloudflare
```

`build:cloudflare` explicitly builds at `/`, even if `BASE_PATH` is set for GitHub Pages.
`preview:cloudflare` rebuilds before starting the local Cloudflare runtime.
`deploy:cloudflare` rebuilds before uploading, so a previous `/mixion/` Pages build cannot
accidentally be deployed to the root. Cloudflare receives no server script, database, or secrets.

`public/_headers` adds `X-Robots-Tag: noindex` to the Cloudflare trial. GitHub Pages does
not interpret this Cloudflare configuration file. Keep the current canonical URL, sitemap,
README links, and GitHub Pages workflow until the custom domain is ready. On the final
cutover, update those URLs and remove the noindex header together. Do not add secrets to
this repository; a later CI deployment should use GitHub Secrets and run after checks pass.

Smoke-check `?sample`, Print → Scan → Animate, PDF/PNG and MP4/GIF exports, language switching,
and the Web Worker asset in a supported browser before switching the public URL.

## Pull requests

- Keep a pull request to one change. Small ones are reviewed quickly.
- Run `npm test` and `npm run lint` before opening it.
- Describe what changed and why, and how you checked it (real scans, the sample, or a simulated scan).
