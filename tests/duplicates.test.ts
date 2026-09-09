import { describe, expect, it } from 'vitest'
import { pageDuplicates, splitDuplicateFiles } from '../src/domain/scan/duplicates'
import { hashBlob } from '../src/lib/files'

const f = (name: string) => ({ name })

describe('hashBlob', () => {
  it('is the same for the same bytes and differs otherwise', async () => {
    const a = await hashBlob(new Blob(['page one']))
    const b = await hashBlob(new Blob(['page one']))
    const c = await hashBlob(new Blob(['page two']))
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('splitDuplicateFiles', () => {
  it('drops files whose content is already imported, naming the scan they repeat', () => {
    const existing = new Map([['h1', 'scan_01.jpg']])
    const r = splitDuplicateFiles([{ file: f('copy of scan_01.jpg'), hash: 'h1' }, { file: f('scan_02.jpg'), hash: 'h2' }], existing)
    expect(r.fresh.map((x) => x.name)).toEqual(['scan_02.jpg'])
    expect(r.skipped).toEqual([{ name: 'copy of scan_01.jpg', sameAs: 'scan_01.jpg' }])
  })
  it('keeps the first of two identical files in one batch', () => {
    const r = splitDuplicateFiles([{ file: f('a.jpg'), hash: 'h' }, { file: f('b.jpg'), hash: 'h' }], new Map())
    expect(r.fresh.map((x) => x.name)).toEqual(['a.jpg'])
    expect(r.skipped).toEqual([{ name: 'b.jpg', sameAs: 'a.jpg' }])
  })
  it('never treats a file without a hash as a duplicate', () => {
    const r = splitDuplicateFiles([{ file: f('a.jpg'), hash: null }, { file: f('b.jpg'), hash: null }], new Map())
    expect(r.fresh).toHaveLength(2)
    expect(r.skipped).toEqual([])
  })
})

describe('pageDuplicates', () => {
  const scans = [
    { id: 'a', name: 'a.jpg', page: 1 },
    { id: 'b', name: 'b.jpg', page: 2 },
    { id: 'c', name: 'c.jpg', page: 1 },
    { id: 'd', name: 'd.jpg', page: null },
  ]
  it('flags only the scans that share a page and says whose frames are in use', () => {
    const outputFrames = new Map([[1, { scanId: 'c' }], [2, { scanId: 'c' }]])
    const r = pageDuplicates(scans, outputFrames, 2)
    expect([...r.keys()].sort()).toEqual(['a', 'c'])
    expect(r.get('a')).toEqual({ page: 1, others: ['c.jpg'], inUse: false })
    expect(r.get('c')).toEqual({ page: 1, others: ['a.jpg'], inUse: true })
  })
  it('marks neither in use while the page is not cut yet', () => {
    const r = pageDuplicates(scans, new Map(), 2)
    expect(r.get('a')?.inUse).toBe(false)
    expect(r.get('c')?.inUse).toBe(false)
  })
})
