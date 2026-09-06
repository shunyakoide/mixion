# Mixion

[![CI](https://github.com/shunyakoide/mixion/actions/workflows/ci.yml/badge.svg)](https://github.com/shunyakoide/mixion/actions/workflows/ci.yml)

[日本語](README.ja.md)

A small web app for mixed media animation: print the frames of a video on paper, draw or collage over them, scan the pages back, and turn them into a video again. Mixion automates the tedious parts of that loop and leaves the drawing to you.

**Print → Draw → Scan → Animate**

Live: https://shunyakoide.github.io/mixion/

- No server, no database, no account. Everything runs in your browser; files never leave it.
- No saved state. Each printed page carries a QR code with the project settings (fps, grid, page number, frame count, source size), so the scan step restores them from the paper itself.
- Browsers: Chrome and Edge (WebCodecs and the save dialog are required).
- Design notes: [docs/PLAN.md](docs/PLAN.md) (Japanese).

## How it works

1. **Print**: drop a video, pick the frame rate and the number of frames per page, save the print PDF. Vertical videos get portrait pages and their own grid options (2×2 / 3×2 / 4×2).
2. **Draw** (on paper): print on A4 and draw. Keep the four corner markers and the QR code clean, and do not cut the pages.
3. **Scan**: scan each page at 300 dpi and import the files. Mixion reads the settings and page number from the QR code, finds the four corner markers, straightens the page and cuts out every frame. Pages can be scanned in either orientation; if the QR is unreadable the markers alone recover the orientation and page number. Only corners that were not found need a click. There are also buttons to re-run detection and to rotate by 90°.
4. **Animate**: optionally drop the original video (for the audio and for frames you did not scan), then export MP4 or GIF.

## Try it without a printer

- **Try the sample** on the first screen loads a bundled 5-second clip (colour bars with a frame counter), renders its print pages as images, imports them as if they were scans, and takes you to Animate.
- **Preview the flow before printing** (small link on the Scan step): after loading your own video, import the pages made in Print without printing them, to settle on fps and grid first.
- Open with `?sample` to start with the sample clip loaded.

## Language

The UI defaults to English and can be switched to Japanese from the header. The choice is stored in `localStorage` under `mixion.locale`; that is the only thing the app stores. Strings live in `src/i18n/en.ts` (source of truth) and `src/i18n/ja.ts`, and a test checks that both have the same keys.

## Development

Requires Node 24 (see `.node-version`).

```bash
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | type check + production build |
| `npm test` | vitest (`tests/`) |
| `npm run lint` | oxlint |
| `npx tsx scripts/dummy-pdf.ts` | writes a print PDF with placeholder images to `out/`, for testing real printers and scanners |

Dev-only hooks (`npm run dev`):

- `http://localhost:5173/?spike=video`: a WebCodecs check page, excluded from production builds
- `window.__dev` in the browser console: `simulateScan(page, {dpi, rotateDeg})` renders a print page as a fake scan; also `imageDiff`, `encodeMp4`, `encodeGif`, the stores and the marker/QR detectors
- `window.__timings`: per-stage timings of the last scan import

### Deployment

`.github/workflows/deploy.yml` builds with `BASE_PATH=/mixion/` on every push to `main` and publishes to GitHub Pages (Settings → Pages → Source must be "GitHub Actions"). To reproduce that build locally:

```bash
BASE_PATH=/mixion/ npm run build && npx vite preview --base /mixion/
```

## Under the hood

| Area | Built with | Used for |
|---|---|---|
| Build | Vite 8, TypeScript 6, Node 24 | dev server, type check, production build; `BASE_PATH` selects the deploy sub-path |
| UI | React 19, Tailwind CSS v4 | the screens; design tokens (colour, type, radius, shadow) live in `@theme` in `src/index.css` |
| Type | Instrument Sans, Noto Sans JP, JetBrains Mono, Space Grotesk (Google Fonts) | text, Japanese, numbers/IDs/file names, the wordmark |
| State | zustand | two stores (Print, Scan); nothing persisted except the locale |
| Video | WebCodecs via mediabunny | in-browser decoding (frame extraction) and MP4 encoding (H.264 + original audio) |
| GIF | gifenc | GIF export |
| PDF | pdf-lib | the A4 print PDF; shares its painting logic with the canvas preview |
| Markers / QR | own ArUco (MIP_36h12) detector and decoder (`src/domain/markers.ts`, `src/features/scan/detectMarkers.ts`), jsqr, qrcode | finding the corners, recovering orientation and page number, embedding and reading the page settings |
| Geometry | own homography (`src/domain/homography.ts`) | straightening scans and cutting out frames; heavy work runs in Web Workers |
| Validation | zod | the settings embedded in the QR code |
| Quality | vitest, oxlint, GitHub Actions (lint → test → build) | unit tests for the domain layer (layout, markers, homography, i18n parity) |
| Saving | File System Access API (`showSaveFilePicker`), download fallback | save dialogs for PDF / MP4 / GIF |

```
src/
  domain/      page layout (mm), frame mapping, homography, markers, QR settings. Pure TS, covered by vitest
  features/    the print / draw / scan / animate screens and their logic
  lib/video/   decoding and MP4/GIF encoding on WebCodecs (mediabunny)
  workers/     the warp Web Worker
  app/         zustand stores, header stepper, bottom dock, dev helpers
  components/  Button / Chip / icons / logo
  i18n/        en (source) and ja dictionaries, locale switch
```

## Contributing

Issues and pull requests are welcome, in English or Japanese. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
