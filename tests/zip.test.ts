import { crc32 as nodeCrc32 } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { buildZip, crc32 } from '../src/lib/zip'

/** Read back the central directory of a store-only zip. */
function readEntries(zip: Uint8Array): { name: string; crc: number; size: number; data: Uint8Array }[] {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const eocd = zip.length - 22
  expect(dv.getUint32(eocd, true)).toBe(0x06054b50)
  const count = dv.getUint16(eocd + 10, true)
  let pos = dv.getUint32(eocd + 16, true)
  const out = []
  for (let i = 0; i < count; i++) {
    expect(dv.getUint32(pos, true)).toBe(0x02014b50)
    const crc = dv.getUint32(pos + 16, true)
    const size = dv.getUint32(pos + 24, true)
    const nameLen = dv.getUint16(pos + 28, true)
    const local = dv.getUint32(pos + 42, true)
    const name = new TextDecoder().decode(zip.subarray(pos + 46, pos + 46 + nameLen))
    expect(dv.getUint32(local, true)).toBe(0x04034b50)
    const localNameLen = dv.getUint16(local + 26, true)
    const start = local + 30 + localNameLen
    out.push({ name, crc, size, data: zip.subarray(start, start + size) })
    pos += 46 + nameLen
  }
  return out
}

describe('buildZip', () => {
  it('matches the platform crc32', () => {
    const data = new TextEncoder().encode('mixion page')
    expect(crc32(data)).toBe(nodeCrc32(data))
    expect(crc32(new Uint8Array(0))).toBe(0)
  })

  it('stores every entry verbatim with a valid directory', () => {
    const a = new Uint8Array([1, 2, 3, 4, 5])
    const b = new TextEncoder().encode('second file, longer than the first')
    const zip = buildZip([
      { name: 'page-01.png', data: a },
      { name: 'ページ-02.png', data: b },
    ])
    const entries = readEntries(zip)
    expect(entries.map((e) => e.name)).toEqual(['page-01.png', 'ページ-02.png'])
    expect(Array.from(entries[0].data)).toEqual(Array.from(a))
    expect(Array.from(entries[1].data)).toEqual(Array.from(b))
    expect(entries[0].crc).toBe(nodeCrc32(a))
    expect(entries[1].crc).toBe(nodeCrc32(b))
    expect(entries[1].size).toBe(b.length)
  })

  it('accepts an empty archive', () => {
    expect(readEntries(buildZip([]))).toEqual([])
  })
})
