import { describe, expect, it } from 'vitest'
import { describeAudioNote, describeError } from '../src/i18n'
import { en } from '../src/i18n/en'
import { ja } from '../src/i18n/ja'
import { MediaError, type MediaErrorInfo } from '../src/lib/errors'

type Tree = Record<string, unknown>

/** Every key present in one dictionary, with the type of its leaf, so the two can be compared. */
function shape(node: unknown, prefix = ''): string[] {
  if (Array.isArray(node)) return [`${prefix}:array(${node.length})`]
  if (typeof node === 'function') return [`${prefix}:fn(${node.length})`]
  if (node && typeof node === 'object') return Object.entries(node as Tree).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k))
  return [`${prefix}:${typeof node}`]
}

describe('translations', () => {
  it('ja has exactly the keys, arities and array lengths of en', () => {
    expect(shape(ja).sort()).toEqual(shape(en).sort())
  })
  it('no leaf is empty', () => {
    const leaves = (node: unknown): unknown[] =>
      Array.isArray(node) ? node.flatMap(leaves) : node && typeof node === 'object' ? Object.values(node as Tree).flatMap(leaves) : [node]
    for (const d of [en, ja]) for (const v of leaves(d)) if (typeof v === 'string') expect(v.trim()).not.toBe('')
  })
})

describe('describeError', () => {
  const infos: MediaErrorInfo[] = [
    { code: 'cannotLoadImage', name: 'page-01.jpg' },
    { code: 'noVideoTrackInFile' },
    { code: 'noVideoTrack' },
    { code: 'cannotDecodeCodec', codec: 'av01' },
    { code: 'cannotDecodeCodec', codec: null },
    { code: 'frameFailed', at: 1.5 },
    { code: 'noFrames' },
    { code: 'cannotEncodeH264' },
    { code: 'mp4Failed' },
  ]
  it('renders every lib error code in both languages, never the code itself', () => {
    for (const dict of [en, ja]) {
      for (const info of infos) {
        const text = describeError(new MediaError(info), dict)
        expect(text.trim()).not.toBe('')
        expect(text).not.toBe(info.code)
      }
    }
  })
  it('carries the detail into the message', () => {
    expect(describeError(new MediaError({ code: 'cannotLoadImage', name: 'page-01.jpg' }), en)).toContain('page-01.jpg')
    expect(describeError(new MediaError({ code: 'cannotDecodeCodec', codec: 'av01' }), ja)).toContain('av01')
    expect(describeError(new MediaError({ code: 'frameFailed', at: 1.5 }), en)).toContain('1.5')
  })
  it('passes other errors through as they are', () => {
    expect(describeError(new Error('canvas context unavailable'), en)).toBe('canvas context unavailable')
    expect(describeError('boom', ja)).toBe('boom')
  })
  it('names every audio note', () => {
    for (const note of ['noAudioTrack', 'unknownAudioCodec', 'noAudioPackets'] as const) {
      expect(describeAudioNote(note, en)).not.toBe(note)
      expect(describeAudioNote(note, ja)).not.toBe(note)
    }
  })
})
