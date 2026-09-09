import { describe, expect, it } from 'vitest'
import { gifWidthOptions, mp4Bitrate, outputDims, parseExportOptions, resolveGifWidth, resolveSize, sizeOptionsFor } from '../src/domain/exportOptions'

const HD = { width: 1920, height: 1080 }
const UHD = { width: 3840, height: 2160 }
const SD = { width: 640, height: 480 }
const PORTRAIT = { width: 1080, height: 1920 }

describe('sizeOptionsFor', () => {
  it('offers the source and every smaller preset, largest first', () => {
    expect(sizeOptionsFor(UHD).map((o) => o.choice)).toEqual(['source', 1080, 720, 480])
    expect(sizeOptionsFor(HD).map((o) => o.choice)).toEqual(['source', 720, 480])
    expect(sizeOptionsFor(SD).map((o) => o.choice)).toEqual(['source'])
  })
  it('scales by the short side and keeps dimensions even', () => {
    expect(outputDims(UHD, 1080)).toEqual(HD)
    expect(outputDims(PORTRAIT, 720)).toEqual({ width: 720, height: 1280 })
    expect(outputDims({ width: 1281, height: 721 }, 'source')).toEqual({ width: 1280, height: 720 })
    expect(outputDims({ width: 1000, height: 1001 }, 720)).toEqual({ width: 720, height: 720 })
  })
})

describe('resolveSize', () => {
  it('keeps a choice the source offers', () => {
    expect(resolveSize(UHD, 720)).toBe(720)
    expect(resolveSize(HD, 'source')).toBe('source')
  })
  it('falls back to 1080p, or to the source when that is not available', () => {
    expect(resolveSize(UHD, 4 as never)).toBe(1080)
    expect(resolveSize(HD, 1080)).toBe('source')
    expect(resolveSize(SD, 720)).toBe('source')
  })
})

describe('mp4Bitrate', () => {
  it('is 8 Mbps for 1080p standard and scales with quality and pixels', () => {
    expect(mp4Bitrate(HD, 'standard')).toBe(8e6)
    expect(mp4Bitrate(HD, 'high')).toBe(16e6)
    expect(mp4Bitrate(HD, 'light')).toBe(4e6)
    expect(mp4Bitrate(UHD, 'standard')).toBe(32e6)
    expect(mp4Bitrate({ width: 1280, height: 720 }, 'light')).toBeCloseTo(1.78e6, -4)
  })
  it('never goes below 1 Mbps', () => {
    expect(mp4Bitrate({ width: 320, height: 240 }, 'light')).toBe(1e6)
  })
})

describe('gif width', () => {
  it('offers only widths that fit the output, and always the smallest', () => {
    expect(gifWidthOptions(HD)).toEqual([320, 480, 640, 960])
    expect(gifWidthOptions({ width: 720, height: 1280 })).toEqual([320, 480, 640])
    expect(gifWidthOptions({ width: 200, height: 200 })).toEqual([320])
  })
  it('falls back to 640, or the widest that fits', () => {
    expect(resolveGifWidth(HD, 960)).toBe(960)
    expect(resolveGifWidth(HD, 100)).toBe(640)
    expect(resolveGifWidth({ width: 480, height: 480 }, 960)).toBe(480)
  })
})

describe('parseExportOptions', () => {
  it('keeps valid stored values and defaults the rest', () => {
    expect(parseExportOptions({ size: 'source', quality: 'high', gifWidth: 320 })).toEqual({ size: 'source', quality: 'high', gifWidth: 320 })
    expect(parseExportOptions({ size: 999, quality: 'best', gifWidth: 5 })).toEqual({ size: 1080, quality: 'standard', gifWidth: 640 })
    expect(parseExportOptions(null)).toEqual({ size: 1080, quality: 'standard', gifWidth: 640 })
  })
})
