<p align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="">
</p>

<h1 align="center">Mixion</h1>

<p align="center">
  Print the frames of a video on paper, draw on them, scan them back, and get an animation.
</p>

<p align="center">
  <a href="https://shunyakoide.github.io/mixion/"><strong>Open the app</strong></a> ·
  <a href="README.ja.md">日本語</a>
</p>

<table align="center">
  <tr>
    <td align="center"><img src="docs/images/drawn-page.jpg" width="380" alt="A printed A4 page with 12 frames of rippling water, the word mixion hand-lettered on each"></td>
    <td align="center"><img src="docs/images/demo.gif" width="460" alt="The scanned pages played back: the lettering wobbles over the moving water"></td>
  </tr>
  <tr>
    <td align="center">A printed page after drawing</td>
    <td align="center">The animation made from the scans</td>
  </tr>
</table>

Mixed media animation is drawing or collaging over the frames of a real video, one by one, on paper. The drawing is the fun part. Splitting the video into frames, laying them out for printing, cutting the scans up again and putting them back in order is not. Mixion does that part.

It runs entirely in your browser. There is no server, no account and nothing to install, and nothing you load is uploaded anywhere. Every printed page carries a QR code with the project settings, so you can close the tab, come back next week with your scans, and carry on from the Scan step on any machine.

## How it works

**1. Print.** Drop a video, choose the frame rate and how many frames go on each page, and save the PDF. Vertical videos get portrait pages.

<img src="docs/images/print.webp" width="800" alt="The Print step: the loaded video, frame rate and grid options, and a preview of the two pages">

**2. Draw.** Print on A4 and draw, paint or paste on the frames. Keep the four corner markers and the QR code clean, and do not cut the pages apart.

**3. Scan.** Scan each page (300 dpi is plenty) and import the files. Mixion reads the page number and settings from the QR code, finds the corner markers, straightens the page and cuts out every frame. Crooked or sideways scans are fine, and so is a phone photo. If a corner was not found, click it.

<img src="docs/images/scan.webp" width="800" alt="The Scan step: two imported pages, all 24 frames cut, with the detected corners and the frame boxes drawn over the scan">

**4. Animate.** Play the result and save it as MP4 or GIF. Drop the original video to bring back its audio and to fill in any frames you did not scan.

<img src="docs/images/animate.webp" width="800" alt="The Animate step: the player, the strip of cut frames, the original video for its audio, and the MP4 and GIF options">

## Try it without a printer

- **Draw digitally.** On the Print step, *Save the pages as PNG* downloads a zip with one 300 dpi image per page instead of the PDF. Open them in Procreate, Clip Studio or Photoshop, draw on a layer above, export each page as a flattened PNG or JPEG at the same size, and import those in Scan. The markers and the QR code are read from the image just as from a scan.
- **Try the sample** on the first screen loads a bundled 5-second clip, renders its print pages, imports them as if they were scans, and stops at Scan so you can look at the pages before going on to Animate.
- **Preview the flow before printing**, a small link on the Scan step, does the same with your own video. Use it to settle on the frame rate and grid before printing.
- Open the app with `?sample` to start with the sample clip loaded.

## Requirements

- A browser with WebCodecs: Chrome or Edge 94 or later, Safari 16.4 or later, or Firefox 130 or later. On iPhone, Safari runs the Scan and Animate steps and saves GIFs; MP4 export there has not been tested yet. Older browsers get a message instead of the app. The save dialog for PDF, MP4 and GIF exists only in Chrome and Edge; other browsers put the file in Downloads.
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
