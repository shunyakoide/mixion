import { describe, expect, it } from 'vitest'
import { missingFeatures, REQUIRED_FEATURES } from '../src/lib/support'

describe('missingFeatures', () => {
  it('reports nothing when every API is present', () => {
    const scope = Object.fromEntries(REQUIRED_FEATURES.map((n) => [n, class {}]))
    expect(missingFeatures(scope)).toEqual([])
  })
  it('names each missing API in a stable order', () => {
    expect(missingFeatures({ Worker: class {}, OffscreenCanvas: class {} })).toEqual(['VideoDecoder', 'VideoEncoder', 'createImageBitmap'])
  })
  it('treats non-callable values as missing', () => {
    const scope = Object.fromEntries(REQUIRED_FEATURES.map((n) => [n, class {}]))
    scope.VideoEncoder = undefined as unknown as typeof scope.VideoEncoder
    expect(missingFeatures(scope)).toEqual(['VideoEncoder'])
  })
  it('reads the global scope by default (node has no WebCodecs)', () => {
    expect(missingFeatures()).toContain('VideoDecoder')
  })
})
