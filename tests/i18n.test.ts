import { describe, expect, it } from 'vitest'
import { en } from '../src/i18n/en'
import { ja } from '../src/i18n/ja'

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
