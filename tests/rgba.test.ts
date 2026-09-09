import { describe, expect, it } from 'vitest'
import { downscaleRgba, thinBlack, type RgbaImage } from '../src/domain/scan/rgba'

/** Build an RGBA image from rows of '#' (black) and '.' (white). */
function fromAscii(rows: string[]): RgbaImage {
  const height = rows.length
  const width = rows[0].length
  const data = new Uint8ClampedArray(width * height * 4)
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const v = row[x] === '#' ? 0 : 255
      const p = (y * width + x) * 4
      data[p] = v
      data[p + 1] = v
      data[p + 2] = v
      data[p + 3] = 255
    }
  })
  return { width, height, data }
}

function toAscii(img: RgbaImage): string[] {
  const rows: string[] = []
  for (let y = 0; y < img.height; y++) {
    let row = ''
    for (let x = 0; x < img.width; x++) row += img.data[(y * img.width + x) * 4] < 128 ? '#' : '.'
    rows.push(row)
  }
  return rows
}

describe('thinBlack', () => {
  it('takes one pixel off every side of a dark blob', () => {
    const img = fromAscii([
      '.......',
      '.#####.',
      '.#####.',
      '.#####.',
      '.#####.',
      '.......',
    ])
    expect(toAscii(thinBlack(img))).toEqual([
      '.......',
      '.......',
      '..###..',
      '..###..',
      '.......',
      '.......',
    ])
  })
  it('removes a one-pixel line entirely and keeps white untouched', () => {
    const img = fromAscii(['.....', '#####', '.....'])
    expect(toAscii(thinBlack(img))).toEqual(['.....', '.....', '.....'])
  })
  it('ignores what lies beyond the border, so an all-dark image stays dark', () => {
    const img = fromAscii(['###', '###', '###'])
    expect(toAscii(thinBlack(img))).toEqual(['###', '###', '###'])
  })
  it('returns an opaque grayscale image of the same size', () => {
    const img = fromAscii(['#.', '.#'])
    const out = thinBlack(img)
    expect(out.width).toBe(2)
    expect(out.height).toBe(2)
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(out.data[i + 1])
      expect(out.data[i]).toBe(out.data[i + 2])
      expect(out.data[i + 3]).toBe(255)
    }
  })
})

describe('downscaleRgba', () => {
  it('averages the source pixels each output pixel covers', () => {
    const img: RgbaImage = { width: 4, height: 2, data: new Uint8ClampedArray(4 * 2 * 4) }
    // Left half black, right half white, on both rows.
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 4; x++) {
        const p = (y * 4 + x) * 4
        const v = x < 2 ? 0 : 255
        img.data[p] = img.data[p + 1] = img.data[p + 2] = v
        img.data[p + 3] = 255
      }
    }
    const out = downscaleRgba(img, 2)
    expect([out.width, out.height]).toEqual([2, 1])
    expect(Array.from(out.data)).toEqual([0, 0, 0, 255, 255, 255, 255, 255])
    const half = downscaleRgba(img, 1)
    expect([half.width, half.height]).toEqual([1, 1])
    expect(half.data[0]).toBeCloseTo(128, -1)
  })
  it('returns the input when it is already narrow enough', () => {
    const img = fromAscii(['#.', '.#'])
    expect(downscaleRgba(img, 2)).toBe(img)
    expect(downscaleRgba(img, 10)).toBe(img)
  })
})
