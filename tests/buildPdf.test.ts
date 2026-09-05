import { deflateSync } from 'node:zlib'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { GRID_PRESETS, mmToPt } from '../src/domain/layout'
import { createProjectSettings } from '../src/domain/settings'
import { buildPrintPdf } from '../src/features/print/buildPdf'

/** Minimal valid RGB PNG so the image path gets exercised without fixtures. */
function tinyPng(width: number, height: number): Uint8Array {
  const crcTable = new Uint32Array(256).map((_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf: Uint8Array) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Uint8Array) => {
    const t = new TextEncoder().encode(type)
    const out = new Uint8Array(12 + data.length)
    const dv = new DataView(out.buffer)
    dv.setUint32(0, data.length)
    out.set(t, 4)
    out.set(data, 8)
    dv.setUint32(8 + data.length, crc(new Uint8Array([...t, ...data])))
    return out
  }
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, width)
  dv.setUint32(4, height)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const raw = new Uint8Array(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * (1 + width * 3) + 1 + x * 3
      raw[i] = (x * 255) / width
      raw[i + 1] = (y * 255) / height
      raw[i + 2] = 128
    }
  }
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  return new Uint8Array([...sig, ...chunk('IHDR', ihdr), ...chunk('IDAT', deflateSync(raw)), ...chunk('IEND', new Uint8Array())])
}

const settings = createProjectSettings({
  projectId: 'k7Qz',
  fps: 8,
  grid: GRID_PRESETS['2x2'],
  dims: { width: 1920, height: 1080 },
  duration: 5,
})

describe('buildPrintPdf', () => {
  it('produces 10 A4 landscape pages with placeholders and reports progress', async () => {
    const progress: number[] = []
    const bytes = await buildPrintPdf({
      settings,
      getFrameImage: async () => null,
      onProgress: (done) => progress.push(done),
    })
    expect(progress).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(10)
    const { width, height } = doc.getPage(0).getSize()
    expect(width).toBeCloseTo(mmToPt(297), 3)
    expect(height).toBeCloseTo(mmToPt(210), 3)
    expect(doc.getTitle()).toBe('Mixion print k7Qz')
  })

  it('embeds PNG frames', async () => {
    const png = tinyPng(16, 9)
    let requested = 0
    const bytes = await buildPrintPdf({
      settings,
      getFrameImage: async (frame) => {
        requested++
        return frame % 2 === 0 ? { kind: 'png', bytes: png } : null
      },
    })
    expect(requested).toBe(40)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(10)
    expect(bytes.length).toBeGreaterThan(10_000)
  })
})
