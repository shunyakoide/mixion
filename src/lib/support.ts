/**
 * The browser APIs Mixion cannot run without, checked once at start-up so an
 * old browser gets a message instead of a broken screen. WebCodecs is the
 * real requirement (Chrome/Edge 94, Safari 16.4, Firefox 130); the others are
 * older but cheap to check.
 */
export const REQUIRED_FEATURES = ['VideoDecoder', 'VideoEncoder', 'OffscreenCanvas', 'Worker', 'createImageBitmap'] as const
export type RequiredFeature = (typeof REQUIRED_FEATURES)[number]

/** Names of the required APIs that `scope` (the global scope by default) does not provide, in a stable order. */
export function missingFeatures(scope: object = globalThis): RequiredFeature[] {
  const s = scope as Record<string, unknown>
  return REQUIRED_FEATURES.filter((name) => typeof s[name] !== 'function')
}
