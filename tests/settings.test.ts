import { describe, expect, it } from 'vitest'
import { GRID_PRESETS } from '../src/domain/layout'
import { qrModules } from '../src/domain/qrEncode'
import {
  buildQrPayload,
  createProjectSettings,
  decodeQrPayload,
  encodeQrPayload,
  generateProjectId,
  layoutFromSettings,
  MAX_PAGES,
  sameProject,
  sameSettings,
  settingsFromQr,
  settingsProblem,
} from '../src/domain/settings'

const HD = { width: 1920, height: 1080 }

const goal = createProjectSettings({
  projectId: 'k7Qz',
  fps: 8,
  grid: GRID_PRESETS['2x2'],
  dims: HD,
  duration: 5,
})

describe('createProjectSettings', () => {
  it('derives 40 frames / 10 pages for the goal scenario', () => {
    expect(goal.frameCount).toBe(40)
    expect(goal.pageCount).toBe(10)
    expect(goal.paper).toBe('A4')
  })
  it('generates an id when none is given', () => {
    const s = createProjectSettings({ fps: 12, grid: GRID_PRESETS['3x3'], dims: HD, duration: 2 })
    expect(s.projectId).toMatch(/^[A-Za-z0-9]{4}$/)
  })
  it('rejects bad fps or empty video', () => {
    expect(() => createProjectSettings({ fps: 0, grid: GRID_PRESETS['2x2'], dims: HD, duration: 5 })).toThrow()
    expect(() => createProjectSettings({ fps: 7.5, grid: GRID_PRESETS['2x2'], dims: HD, duration: 5 })).toThrow()
    expect(() => createProjectSettings({ fps: 8, grid: GRID_PRESETS['2x2'], dims: HD, duration: 0 })).toThrow()
  })
  it('rejects more pages than the corner markers can label', () => {
    // 62 pages of 4 frames at 8 fps is 31 s; a frame more needs a 63rd page.
    expect(createProjectSettings({ fps: 8, grid: GRID_PRESETS['2x2'], dims: HD, duration: 31 }).pageCount).toBe(MAX_PAGES)
    expect(() => createProjectSettings({ fps: 8, grid: GRID_PRESETS['2x2'], dims: HD, duration: 31.125 })).toThrow(/pages/)
  })
})

describe('settingsProblem', () => {
  it('names what keeps a video from printing', () => {
    expect(settingsProblem({ fps: 8, grid: GRID_PRESETS['2x2'], duration: 0 })).toBe('tooShort')
    expect(settingsProblem({ fps: 8, grid: GRID_PRESETS['2x2'], duration: 60 })).toBe('tooManyPages')
    expect(settingsProblem({ fps: 8, grid: GRID_PRESETS['2x2'], duration: 5 })).toBeNull()
    // A larger grid brings the same video back under the limit.
    expect(settingsProblem({ fps: 8, grid: GRID_PRESETS['4x3'], duration: 60 })).toBeNull()
  })
})

describe('generateProjectId', () => {
  it('uses only unambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateProjectId()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]{4}$/)
    }
  })
})

describe('QR payload', () => {
  it('builds the expected payload for page 3', () => {
    expect(buildQrPayload(goal, 3)).toEqual({
      v: 2,
      p: 'k7Qz',
      pg: 3,
      of: 10,
      f: [9, 12],
      n: 40,
      fps: 8,
      g: '2x2',
      d: [1920, 1080],
    })
  })
  it('encodes as a short slash-separated string', () => {
    expect(encodeQrPayload(goal, 3)).toBe('2/k7Qz/3/40/8/2x2/1920x1080')
  })
  it('needs at most 29 modules, even for a large project', () => {
    // The v1 JSON took 41 modules, too dense in 16 mm for a 300 dpi scan of an inkjet print.
    expect(qrModules(encodeQrPayload(goal, 3)).length).toBe(25)
    expect(qrModules(encodeQrPayload(goal, 10)).length).toBeLessThanOrEqual(29)
    const large = createProjectSettings({ projectId: 'AbCdEfGh', fps: 30, grid: { cols: 10, rows: 10 }, dims: { width: 3840, height: 2160 }, duration: 206 })
    expect(large.pageCount).toBe(MAX_PAGES)
    expect(qrModules(encodeQrPayload(large, MAX_PAGES)).length).toBeLessThanOrEqual(29)
  })
  it('round-trips through encode/decode for every page', () => {
    for (let page = 1; page <= goal.pageCount; page++) {
      const r = decodeQrPayload(encodeQrPayload(goal, page))
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.payload).toEqual(buildQrPayload(goal, page))
    }
  })
  it('rebuilds identical settings and layout from any page', () => {
    const r = decodeQrPayload(encodeQrPayload(goal, 7))
    if (!r.ok) throw new Error(r.error)
    const restored = settingsFromQr(r.payload)
    expect(restored).toEqual(goal)
    expect(layoutFromSettings(restored)).toEqual(layoutFromSettings(goal))
  })
  it('rejects pages out of range', () => {
    expect(() => buildQrPayload(goal, 0)).toThrow()
    expect(() => buildQrPayload(goal, 11)).toThrow()
  })
})

describe('decodeQrPayload', () => {
  const good = buildQrPayload(goal, 3)
  const v1 = { ...good, v: 1 }
  const mutateJson = (patch: Record<string, unknown>) => decodeQrPayload(JSON.stringify({ ...v1, ...patch }))
  const compact = (parts: (string | number)[]) => decodeQrPayload(parts.join('/'))

  it('rejects foreign QR codes', () => {
    expect(decodeQrPayload('https://example.com').ok).toBe(false)
    expect(decodeQrPayload('').ok).toBe(false)
    expect(decodeQrPayload('{"hello":"world"}').ok).toBe(false)
    expect(decodeQrPayload('2/k7Qz/3/40/8/2x2').ok).toBe(false)
    expect(decodeQrPayload('2/k7Qz/3/40/8/2x2/1920x1080/extra').ok).toBe(false)
  })
  it('still reads version 1 JSON from older printouts', () => {
    const r = mutateJson({})
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.payload).toEqual(v1)
      expect(settingsFromQr(r.payload)).toEqual(goal)
    }
  })
  it('rejects a different version in either format', () => {
    expect(mutateJson({ v: 2 }).ok).toBe(false)
    expect(mutateJson({ v: 3 }).ok).toBe(false)
    expect(compact([1, 'k7Qz', 3, 40, 8, '2x2', '1920x1080']).ok).toBe(false)
    expect(compact([3, 'k7Qz', 3, 40, 8, '2x2', '1920x1080']).ok).toBe(false)
  })
  it('rejects unknown keys', () => {
    expect(mutateJson({ extra: 1 }).ok).toBe(false)
  })
  it('rejects inconsistent page/frame data', () => {
    expect(mutateJson({ pg: 11 }).ok).toBe(false)
    expect(mutateJson({ f: [9, 13] }).ok).toBe(false)
    expect(mutateJson({ f: [5, 8] }).ok).toBe(false)
    expect(mutateJson({ of: 9 }).ok).toBe(false)
    expect(mutateJson({ n: 41 }).ok).toBe(false)
    expect(compact([2, 'k7Qz', 11, 40, 8, '2x2', '1920x1080']).ok).toBe(false)
    expect(compact([2, 'k7Qz', 0, 40, 8, '2x2', '1920x1080']).ok).toBe(false)
    expect(compact([2, 'k7Qz', 1, 0, 8, '2x2', '1920x1080']).ok).toBe(false)
  })
  it('rejects bad grid, fps, dims or project id', () => {
    expect(mutateJson({ g: '2x' }).ok).toBe(false)
    expect(mutateJson({ fps: 0 }).ok).toBe(false)
    expect(mutateJson({ fps: 8.5 }).ok).toBe(false)
    expect(compact([2, 'k7Qz', 3, 40, 8, '2x', '1920x1080']).ok).toBe(false)
    expect(compact([2, 'k7Qz', 3, 40, 0, '2x2', '1920x1080']).ok).toBe(false)
    expect(compact([2, 'k7Qz', 3, 40, 8.5, '2x2', '1920x1080']).ok).toBe(false)
    expect(compact([2, 'k7Qz', 3, 40, 8, '2x2', '1920']).ok).toBe(false)
    expect(compact([2, 'k7', 3, 40, 8, '2x2', '1920x1080']).ok).toBe(false)
    expect(compact([2, 'k7Qz', 3, 40, 8, '2x2', '0x1080']).ok).toBe(false)
  })
  it('reports an error message', () => {
    const r = mutateJson({ n: 41 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0)
  })
})

describe('sameSettings', () => {
  it('is the same print run only when every cut line matches', () => {
    expect(sameSettings(goal, { ...goal })).toBe(true)
    expect(sameSettings(goal, { ...goal, grid: GRID_PRESETS['3x3'] })).toBe(false)
    expect(sameSettings(goal, { ...goal, fps: 12 })).toBe(false)
    expect(sameSettings(goal, { ...goal, projectId: 'efgh' })).toBe(false)
  })
})

describe('sameProject', () => {
  it('matches pages from the same run and rejects others', () => {
    expect(sameProject(buildQrPayload(goal, 1), buildQrPayload(goal, 10))).toBe(true)
    const other = createProjectSettings({ projectId: 'Abcd', fps: 8, grid: GRID_PRESETS['2x2'], dims: HD, duration: 5 })
    expect(sameProject(buildQrPayload(goal, 1), buildQrPayload(other, 1))).toBe(false)
  })
  it('treats a version 1 printout as a different run', () => {
    expect(sameProject(buildQrPayload(goal, 1), { ...buildQrPayload(goal, 2), v: 1 })).toBe(false)
  })
})
