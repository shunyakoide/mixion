import { describe, expect, it } from 'vitest'
import { thinBlack } from '../src/lib/image'
import type { RgbaImage } from '../src/features/scan/warp'

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
