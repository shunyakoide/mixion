/**
 * Minimal ZIP writer, "store" method only. The PNG pages it packs are already
 * compressed, so deflating them again would cost time for nothing, and this
 * keeps the app free of a zip dependency. Produces archives that macOS,
 * Windows, the iPadOS Files app and every unzip tool accept.
 */

export interface ZipEntry {
  name: string
  data: Uint8Array
  /** File modification time, defaults to now. */
  date?: Date
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** DOS date/time pair as stored in zip headers (2-second resolution, 1980+). */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

export function buildZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const now = new Date()
  const local: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const { time, date } = dosDateTime(entry.date ?? now)
    const size = entry.data.length

    const lh = new Uint8Array(30 + name.length)
    const ldv = new DataView(lh.buffer)
    ldv.setUint32(0, 0x04034b50, true)
    ldv.setUint16(4, 20, true) // version needed
    ldv.setUint16(6, 0x0800, true) // flags: UTF-8 names
    ldv.setUint16(8, 0, true) // method: store
    ldv.setUint16(10, time, true)
    ldv.setUint16(12, date, true)
    ldv.setUint32(14, crc, true)
    ldv.setUint32(18, size, true)
    ldv.setUint32(22, size, true)
    ldv.setUint16(26, name.length, true)
    ldv.setUint16(28, 0, true)
    lh.set(name, 30)

    const ch = new Uint8Array(46 + name.length)
    const cdv = new DataView(ch.buffer)
    cdv.setUint32(0, 0x02014b50, true)
    cdv.setUint16(4, 20, true) // version made by
    cdv.setUint16(6, 20, true) // version needed
    cdv.setUint16(8, 0x0800, true)
    cdv.setUint16(10, 0, true)
    cdv.setUint16(12, time, true)
    cdv.setUint16(14, date, true)
    cdv.setUint32(16, crc, true)
    cdv.setUint32(20, size, true)
    cdv.setUint32(24, size, true)
    cdv.setUint16(28, name.length, true)
    cdv.setUint16(30, 0, true) // extra
    cdv.setUint16(32, 0, true) // comment
    cdv.setUint16(34, 0, true) // disk
    cdv.setUint16(36, 0, true) // internal attrs
    cdv.setUint32(38, 0, true) // external attrs
    cdv.setUint32(42, offset, true)
    ch.set(name, 46)

    local.push(lh, entry.data)
    central.push(ch)
    offset += lh.length + size
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0)
  const eocd = new Uint8Array(22)
  const edv = new DataView(eocd.buffer)
  edv.setUint32(0, 0x06054b50, true)
  edv.setUint16(4, 0, true)
  edv.setUint16(6, 0, true)
  edv.setUint16(8, entries.length, true)
  edv.setUint16(10, entries.length, true)
  edv.setUint32(12, centralSize, true)
  edv.setUint32(16, offset, true)
  edv.setUint16(20, 0, true)

  const out = new Uint8Array(offset + centralSize + 22)
  let pos = 0
  for (const part of [...local, ...central, eocd]) {
    out.set(part, pos)
    pos += part.length
  }
  return out
}
