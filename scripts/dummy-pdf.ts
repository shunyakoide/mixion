/**
 * Print-test helper: writes a Mixion print PDF with placeholder frames so the
 * page format (markers, margins, QR, ticks) can be printed and scanned before
 * video decoding exists.
 *
 *   npx tsx scripts/dummy-pdf.ts [--fps 8] [--grid 2x2] [--seconds 5] [--out out/dummy-print.pdf]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseGrid } from '../src/domain/layout'
import { createProjectSettings, layoutFromSettings } from '../src/domain/settings'
import { buildPrintPdf } from '../src/features/print/buildPdf'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const fps = Number(arg('fps', '8'))
const grid = parseGrid(arg('grid', '2x2'))
const seconds = Number(arg('seconds', '5'))
const out = arg('out', 'out/dummy-print.pdf')
if (!grid) throw new Error('bad --grid, expected e.g. 2x2')

const settings = createProjectSettings({
  projectId: 'TEST',
  fps,
  grid,
  dims: { width: 1920, height: 1080 },
  duration: seconds,
})
const layout = layoutFromSettings(settings)
console.log(
  `${settings.frameCount} frames, ${settings.pageCount} pages, A4 ${layout.orientation}, ` +
    `frame ${layout.cells[0].imageRect.w.toFixed(1)}x${layout.cells[0].imageRect.h.toFixed(1)} mm`,
)

const bytes = await buildPrintPdf({ settings, layout, getFrameImage: async () => null })
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, bytes)
console.log(`wrote ${out} (${(bytes.length / 1024).toFixed(0)} KB)`)
