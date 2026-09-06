import { describe, expect, it } from 'vitest'
import { deriveSettings } from '../src/app/store'
import type { VideoInfo } from '../src/lib/video/decode'

const info = (width: number, height: number): VideoInfo => ({ duration: 3, width, height, frameRate: 30, hasAudio: false, audioCodec: null, videoCodec: 'avc1', canDecodeVideo: true })

describe('deriveSettings', () => {
  it('uses the chosen preset for a landscape video', () => {
    const s = deriveSettings({ info: info(1920, 1080), fps: 8, gridKey: '4x3', projectId: 'k7Qz' })
    expect(s?.grid).toEqual({ cols: 4, rows: 3 })
    expect(s?.pageCount).toBe(2)
  })
  it('drops a row for a vertical video so the preset stays meaningful', () => {
    const s = deriveSettings({ info: info(1080, 1920), fps: 8, gridKey: '4x3', projectId: 'k7Qz' })
    expect(s?.grid).toEqual({ cols: 4, rows: 2 })
    expect(s?.dims).toEqual({ width: 1080, height: 1920 })
    expect(s?.pageCount).toBe(3)
  })
  it('is null without a video', () => {
    expect(deriveSettings({ info: null, fps: 8, gridKey: '2x2', projectId: 'k7Qz' })).toBeNull()
  })
})
