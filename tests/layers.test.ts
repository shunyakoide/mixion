/**
 * The layer rule from CONTRIBUTING: `src/domain` is pure and depends on
 * nothing else in src; `src/lib` and `src/workers` build on it and never
 * reach up into the screens or the stores. A worker or a test that imports
 * from a screen folder is how the rule used to break.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../src')

/** Which top-level folders each layer may import from (besides itself and packages). */
const ALLOWED: Record<string, string[]> = {
  domain: [],
  lib: ['domain', 'i18n'],
  workers: ['domain', 'lib'],
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(name) ? [p] : []
  })
}

/** Relative import specifiers of a file, static and dynamic. */
function imports(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  return [...text.matchAll(/(?:from|import)\s*\(?\s*'(\.[^']+)'/g)].map((m) => m[1])
}

function layerOf(file: string): string {
  return relative(SRC, file).split('/')[0]
}

describe('src layers', () => {
  for (const [layer, allowed] of Object.entries(ALLOWED)) {
    it(`${layer} imports only from ${[layer, ...allowed].join(', ')}`, () => {
      const offences: string[] = []
      for (const file of walk(join(SRC, layer))) {
        for (const spec of imports(file)) {
          const target = layerOf(resolve(dirname(file), spec))
          if (target !== layer && !allowed.includes(target)) offences.push(`${relative(SRC, file)} → ${spec}`)
        }
      }
      expect(offences).toEqual([])
    })
  }
})
