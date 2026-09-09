import type { Dims } from './layout'

/** Output size by the short side in px, or the source video's own size. */
export type SizeChoice = 'source' | 1080 | 720 | 480
export type Mp4Quality = 'high' | 'standard' | 'light'

export interface ExportOptions {
  size: SizeChoice
  quality: Mp4Quality
  gifWidth: number
}

/** Presets below the source, largest first. */
export const SIZE_PRESETS = [1080, 720, 480] as const
export const GIF_WIDTHS = [320, 480, 640, 960] as const
export const MP4_QUALITIES = ['high', 'standard', 'light'] as const

/** HD is plenty for a drawing traced from a 60 mm print; the source's own size stays available. */
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = { size: 1080, quality: 'standard', gifWidth: 640 }

/** Bits per second for 1080p at the standard quality; other sizes scale with their pixel count. */
const BITRATE_1080P = 8e6
const QUALITY_FACTOR: Record<Mp4Quality, number> = { high: 2, standard: 1, light: 0.5 }

function even(n: number): number {
  const r = Math.round(n)
  return Math.max(2, r - (r % 2))
}

export interface SizeOption {
  choice: SizeChoice
  dims: Dims
}

/**
 * The sizes a source can be exported at: its own size, then every preset whose
 * short side is smaller. A 1080p source gets 'source', 720 and 480; a 4K one 'source', 1080, 720, 480.
 * Dimensions are even, as H.264 needs.
 */
export function sizeOptionsFor(source: Dims): SizeOption[] {
  const short = Math.min(source.width, source.height)
  const options: SizeOption[] = [{ choice: 'source', dims: { width: even(source.width), height: even(source.height) } }]
  for (const p of SIZE_PRESETS) {
    if (p >= short) continue
    const k = p / short
    options.push({ choice: p, dims: { width: even(source.width * k), height: even(source.height * k) } })
  }
  return options
}

/** The stored choice if the source offers it, else the default: 1080p when the source is bigger, otherwise the source itself. */
export function resolveSize(source: Dims, choice: SizeChoice): SizeChoice {
  const options = sizeOptionsFor(source)
  if (options.some((o) => o.choice === choice)) return choice
  return options.some((o) => o.choice === DEFAULT_EXPORT_OPTIONS.size) ? DEFAULT_EXPORT_OPTIONS.size : 'source'
}

export function outputDims(source: Dims, choice: SizeChoice): Dims {
  const resolved = resolveSize(source, choice)
  return sizeOptionsFor(source).find((o) => o.choice === resolved)!.dims
}

/** H.264 bitrate: 8 Mbps for 1080p at the standard quality, twice that for high, half for light, scaled by the pixel count. */
export function mp4Bitrate(dims: Dims, quality: Mp4Quality): number {
  const pixels = dims.width * dims.height
  return Math.max(1e6, Math.round((BITRATE_1080P * pixels * QUALITY_FACTOR[quality]) / (1920 * 1080)))
}

/** GIF widths that do not exceed the output width; the smallest preset is always offered. */
export function gifWidthOptions(output: Dims): number[] {
  const fit = GIF_WIDTHS.filter((w) => w <= output.width)
  return fit.length > 0 ? fit : [GIF_WIDTHS[0]]
}

export function resolveGifWidth(output: Dims, width: number): number {
  const options = gifWidthOptions(output)
  if (options.includes(width)) return width
  return options.includes(DEFAULT_EXPORT_OPTIONS.gifWidth) ? DEFAULT_EXPORT_OPTIONS.gifWidth : options[options.length - 1]
}

export function isSizeChoice(v: unknown): v is SizeChoice {
  return v === 'source' || (SIZE_PRESETS as readonly number[]).includes(v as number)
}

export function isMp4Quality(v: unknown): v is Mp4Quality {
  return (MP4_QUALITIES as readonly string[]).includes(v as string)
}

/** Parse a stored options object, keeping the defaults for anything missing or malformed. */
export function parseExportOptions(raw: unknown): ExportOptions {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    size: isSizeChoice(o.size) ? o.size : DEFAULT_EXPORT_OPTIONS.size,
    quality: isMp4Quality(o.quality) ? o.quality : DEFAULT_EXPORT_OPTIONS.quality,
    gifWidth: (GIF_WIDTHS as readonly number[]).includes(o.gifWidth as number) ? (o.gifWidth as number) : DEFAULT_EXPORT_OPTIONS.gifWidth,
  }
}
