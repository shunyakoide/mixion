/**
 * Project settings and the QR payload printed on every page.
 *
 * Mixion keeps no state between Print and Scan. Everything the scan side needs
 * to rebuild the page layout travels on the paper itself, inside the QR code.
 * `settingsFromQr` must therefore reproduce exactly the layout that
 * `createProjectSettings` produced at print time.
 */
import { z } from 'zod'
import { frameCount, frameRangeOnPage, framesPerPage, pageCount } from './frameMap'
import { MAX_MARKER_PAGES } from './markers'
import {
  computeLayout,
  formatGrid,
  parseGrid,
  type Dims,
  type Grid,
  type Layout,
  type Paper,
} from './layout'

/**
 * Version of the printed page: the QR payload and the layout it describes.
 * Version 1 was JSON; version 2 is a short `/`-separated string, so a typical
 * project needs a 25-module code instead of a 41-module one and each module
 * prints about 1.6× larger in the same 16 mm square. Both versions are still
 * read; the page layout did not change between them. A change that moves the
 * markers, cells or QR needs a new version too, even if the fields stay the
 * same, since the scan side rebuilds the layout from this payload alone.
 */
export const QR_VERSION = 2

/** Unambiguous alphabet for project ids (no 0/O, 1/I/l). */
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
const PROJECT_ID_LENGTH = 4

export function generateProjectId(length = PROJECT_ID_LENGTH): string {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  let id = ''
  for (const b of bytes) id += ID_ALPHABET[b % ID_ALPHABET.length]
  return id
}

export interface ProjectSettings {
  projectId: string
  paper: Paper
  fps: number
  grid: Grid
  /** Source video pixel size. Also the output video size. */
  dims: Dims
  frameCount: number
  pageCount: number
}

export interface CreateSettingsInput {
  projectId?: string
  fps: number
  grid: Grid
  dims: Dims
  /** Source video duration in seconds. */
  duration: number
  paper?: Paper
}

export const FPS_PRESETS = [6, 8, 12] as const
export const FPS_MIN = 1
export const FPS_MAX = 30

export function isValidFps(fps: number): boolean {
  return Number.isInteger(fps) && fps >= FPS_MIN && fps <= FPS_MAX
}

/** Pages a project can have: every page carries four corner markers of its own. */
export const MAX_PAGES = MAX_MARKER_PAGES

export type SettingsProblem = 'tooShort' | 'tooManyPages'

/** Why a video cannot be printed with these settings, if it cannot. */
export function settingsProblem(input: Pick<CreateSettingsInput, 'fps' | 'grid' | 'duration'>): SettingsProblem | null {
  const total = frameCount(input.duration, input.fps)
  if (total === 0) return 'tooShort'
  if (pageCount(total, framesPerPage(input.grid)) > MAX_PAGES) return 'tooManyPages'
  return null
}

export function createProjectSettings(input: CreateSettingsInput): ProjectSettings {
  if (!isValidFps(input.fps)) throw new Error(`fps must be an integer between ${FPS_MIN} and ${FPS_MAX}`)
  const problem = settingsProblem(input)
  if (problem === 'tooShort') throw new Error('video is too short or duration is unknown')
  if (problem === 'tooManyPages') throw new Error(`more than ${MAX_PAGES} pages: the corner markers cannot label them`)
  const total = frameCount(input.duration, input.fps)
  return {
    projectId: input.projectId ?? generateProjectId(),
    paper: input.paper ?? 'A4',
    fps: input.fps,
    grid: input.grid,
    dims: input.dims,
    frameCount: total,
    pageCount: pageCount(total, framesPerPage(input.grid)),
  }
}

export function layoutFromSettings(settings: ProjectSettings): Layout {
  return computeLayout({ paper: settings.paper, grid: settings.grid, dims: settings.dims })
}

/** What every page carries. Keys are short on purpose (they are the v1 JSON keys). */
const qrPayloadSchema = z
  .object({
    /** QR payload version */
    v: z.union([z.literal(1), z.literal(2)]),
    /** project id */
    p: z.string().regex(/^[A-Za-z0-9]{4,8}$/),
    /** this page (1-based) */
    pg: z.number().int().min(1),
    /** total pages */
    of: z.number().int().min(1),
    /** first and last frame on this page (1-based, inclusive) */
    f: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
    /** total frames */
    n: z.number().int().min(1),
    fps: z.number().int().min(FPS_MIN).max(FPS_MAX),
    /** grid "colsxrows" */
    g: z.string().regex(/^\d+x\d+$/),
    /** source dims [width, height] */
    d: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  })
  .strict()

export type QrPayload = z.infer<typeof qrPayloadSchema>

export function buildQrPayload(settings: ProjectSettings, page: number): QrPayload {
  if (page < 1 || page > settings.pageCount) throw new Error(`page ${page} out of range`)
  const range = frameRangeOnPage(page, framesPerPage(settings.grid), settings.frameCount)
  if (!range) throw new Error(`page ${page} has no frames`)
  return {
    v: QR_VERSION,
    p: settings.projectId,
    pg: page,
    of: settings.pageCount,
    f: range,
    n: settings.frameCount,
    fps: settings.fps,
    g: formatGrid(settings.grid),
    d: [settings.dims.width, settings.dims.height],
  }
}

/**
 * Text printed in the QR: `2/<project>/<page>/<frames>/<fps>/<grid>/<width>x<height>`.
 * Page count and the frame range are left out because they follow from the rest.
 */
export function encodeQrPayload(settings: ProjectSettings, page: number): string {
  const p = buildQrPayload(settings, page)
  return [p.v, p.p, p.pg, p.n, p.fps, p.g, `${p.d[0]}x${p.d[1]}`].join('/')
}

export type DecodeResult = { ok: true; payload: QrPayload } | { ok: false; error: string }

type RawResult = { ok: true; value: unknown } | { ok: false; error: string }

/** Version 1: the payload as JSON. */
function parseJsonPayload(text: string): RawResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'not JSON' }
  }
  const v = typeof json === 'object' && json !== null ? (json as { v?: unknown }).v : undefined
  if (v !== 1) return { ok: false, error: `unsupported version ${String(v)}` }
  return { ok: true, value: json }
}

/** Version 2: `2/<project>/<page>/<frames>/<fps>/<grid>/<width>x<height>`. */
function parseCompactPayload(text: string): RawResult {
  const parts = text.trim().split('/')
  if (parts.length !== 7) return { ok: false, error: 'not a Mixion payload' }
  const [v, p, pg, n, fps, g, d] = parts
  if (v !== '2') return { ok: false, error: `unsupported version ${v}` }
  const int = (s: string) => (/^\d{1,6}$/.test(s) ? Number(s) : NaN)
  const dims = /^(\d{1,5})x(\d{1,5})$/.exec(d)
  const grid = parseGrid(g)
  const page = int(pg)
  const total = int(n)
  if (!grid || !dims || !Number.isFinite(page) || !Number.isFinite(total) || !Number.isFinite(int(fps))) {
    return { ok: false, error: 'malformed fields' }
  }
  if (page < 1 || total < 1) return { ok: false, error: 'page or frame count out of range' }
  const perPage = framesPerPage(grid)
  const f = frameRangeOnPage(page, perPage, total)
  if (!f) return { ok: false, error: 'page number exceeds page count' }
  const value: QrPayload = { v: 2, p, pg: page, of: pageCount(total, perPage), f, n: total, fps: int(fps), g, d: [Number(dims[1]), Number(dims[2])] }
  return { ok: true, value }
}

/**
 * Parse and validate QR text in either version. Also checks internal
 * consistency, so a payload that was damaged in a way that still parses is
 * rejected.
 */
export function decodeQrPayload(text: string): DecodeResult {
  const raw = text.trimStart().startsWith('{') ? parseJsonPayload(text) : parseCompactPayload(text)
  if (!raw.ok) return raw
  const parsed = qrPayloadSchema.safeParse(raw.value)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
  }
  const p = parsed.data
  const grid = parseGrid(p.g)
  if (!grid) return { ok: false, error: `bad grid ${p.g}` }
  const perPage = framesPerPage(grid)
  if (p.pg > p.of) return { ok: false, error: 'page number exceeds page count' }
  if (pageCount(p.n, perPage) !== p.of) return { ok: false, error: 'page count does not match frame count' }
  const expected = frameRangeOnPage(p.pg, perPage, p.n)
  if (!expected || expected[0] !== p.f[0] || expected[1] !== p.f[1]) {
    return { ok: false, error: 'frame range does not match page' }
  }
  return { ok: true, payload: p }
}

export function settingsFromQr(payload: QrPayload): ProjectSettings {
  const grid = parseGrid(payload.g)
  if (!grid) throw new Error(`bad grid ${payload.g}`)
  return {
    projectId: payload.p,
    paper: 'A4',
    fps: payload.fps,
    grid,
    dims: { width: payload.d[0], height: payload.d[1] },
    frameCount: payload.n,
    pageCount: payload.of,
  }
}

/** True when two pages belong to the same print run. */
export function sameProject(a: QrPayload, b: QrPayload): boolean {
  return (
    a.p === b.p &&
    a.v === b.v &&
    a.of === b.of &&
    a.n === b.n &&
    a.fps === b.fps &&
    a.g === b.g &&
    a.d[0] === b.d[0] &&
    a.d[1] === b.d[1]
  )
}
