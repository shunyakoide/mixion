import { describe, expect, it } from 'vitest'
import { GRID_PRESETS } from '../src/domain/layout'
import {
  buildQrPayload,
  createProjectSettings,
  decodeQrPayload,
  encodeQrPayload,
  generateProjectId,
  layoutFromSettings,
  sameProject,
  settingsFromQr,
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
      v: 1,
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
  it('stays short enough for a small QR', () => {
    expect(encodeQrPayload(goal, 10).length).toBeLessThan(100)
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
  const mutate = (patch: Record<string, unknown>) => decodeQrPayload(JSON.stringify({ ...good, ...patch }))

  it('rejects non-JSON and foreign QR codes', () => {
    expect(decodeQrPayload('https://example.com').ok).toBe(false)
    expect(decodeQrPayload('').ok).toBe(false)
    expect(decodeQrPayload('{"hello":"world"}').ok).toBe(false)
  })
  it('rejects a different version', () => {
    expect(mutate({ v: 2 }).ok).toBe(false)
  })
  it('rejects unknown keys', () => {
    expect(mutate({ extra: 1 }).ok).toBe(false)
  })
  it('rejects inconsistent page/frame data', () => {
    expect(mutate({ pg: 11 }).ok).toBe(false)
    expect(mutate({ f: [9, 13] }).ok).toBe(false)
    expect(mutate({ f: [5, 8] }).ok).toBe(false)
    expect(mutate({ of: 9 }).ok).toBe(false)
    expect(mutate({ n: 41 }).ok).toBe(false)
  })
  it('rejects bad grid or fps', () => {
    expect(mutate({ g: '2x' }).ok).toBe(false)
    expect(mutate({ fps: 0 }).ok).toBe(false)
    expect(mutate({ fps: 8.5 }).ok).toBe(false)
  })
  it('reports an error message', () => {
    const r = mutate({ n: 41 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0)
  })
})

describe('sameProject', () => {
  it('matches pages from the same run and rejects others', () => {
    expect(sameProject(buildQrPayload(goal, 1), buildQrPayload(goal, 10))).toBe(true)
    const other = createProjectSettings({ projectId: 'Abcd', fps: 8, grid: GRID_PRESETS['2x2'], dims: HD, duration: 5 })
    expect(sameProject(buildQrPayload(goal, 1), buildQrPayload(other, 1))).toBe(false)
  })
})
