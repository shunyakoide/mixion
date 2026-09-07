# Mixion

Print the frames of a video on paper, draw on them, scan them back, and get an animation.

[Open the app](https://shunyakoide.github.io/mixion/) · [日本語](README.ja.md)

Mixed media animation is drawing or collaging over the frames of a real video, one by one, on paper. The drawing is the fun part. Splitting the video into frames, laying them out for printing, cutting the scans up again and putting them back in order is not. Mixion does that part.

It runs entirely in your browser. There is no server, no account and nothing to install, and nothing you load is uploaded anywhere. Every printed page carries a QR code with the project settings, so you can close the tab, come back next week with your scans, and carry on from the Scan step on any machine.

## How it works

1. **Print.** Drop a video, choose the frame rate and how many frames go on each page, and save the PDF. Vertical videos get portrait pages.
2. **Draw.** Print on A4 and draw, paint or paste on the frames. Keep the four corner markers and the QR code clean, and do not cut the pages apart.
3. **Scan.** Scan each page (300 dpi is plenty) and import the files. Mixion reads the page number and settings from the QR code, finds the corner markers, straightens the page and cuts out every frame. Crooked or sideways scans are fine, and so is a phone photo. If a corner was not found, click it.
4. **Animate.** Play the result and save it as MP4 or GIF. Drop the original video to bring back its audio and to fill in any frames you did not scan.

## Try it without a printer

- **Draw digitally.** On the Print step, *Save the pages as PNG* downloads a zip with one 300 dpi image per page instead of the PDF. Open them in Procreate, Clip Studio or Photoshop, draw on a layer above, export each page as a flattened PNG or JPEG at the same size, and import those in Scan. The markers and the QR code are read from the image just as from a scan.
- **Try the sample** on the first screen loads a bundled 5-second clip, renders its print pages, imports them as if they were scans, and takes you to Animate.
- **Preview the flow before printing**, a small link on the Scan step, does the same with your own video. Use it to settle on the frame rate and grid before printing.
- Open the app with `?sample` to start with the sample clip loaded.

## Requirements

- Chrome or Edge. Mixion uses WebCodecs for video and the File System Access API for save dialogs; Safari and Firefox are not supported yet.
- A printer for A4 paper and a scanner, or a phone camera.

The interface is in English and Japanese. The chosen language is the only thing the app stores in the browser.

## Development

Requires Node 24 (see `.node-version`).

```bash
npm install
npm run dev
```

`npm test` runs the unit tests, `npm run lint` runs oxlint, and `npm run build` type-checks and builds. How the code is organised, the dev-only hooks for faking scans, and how the site is deployed are described in [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome, in English or Japanese.

## License

[MIT](LICENSE)
