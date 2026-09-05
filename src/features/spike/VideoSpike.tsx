/**
 * Dev-only check for Issue 9: can this browser decode 40 frames from the
 * 5 s sample, encode them back to H.264 MP4, and keep the audio?
 * Open with ?spike=video. Results are also put on window.__spike.
 */
import { useState } from 'react'
import { frameCount, frameTimestamp } from '../../domain/frameMap'
import { encodeMp4 } from '../../lib/video/encode'
import { extractFrames, probeVideo, type ExtractedFrame, type VideoInfo } from '../../lib/video/decode'

const SAMPLE_URL = new URL('../../../fixtures/sample-5s.mp4', import.meta.url).href
const FPS = 8

interface SpikeResult {
  info: VideoInfo
  frameCount: number
  extractMs: number
  actualTimestamps: number[]
  frameBytes: number
  encodeMs: number
  mp4Bytes: number
  audioCopied: boolean
  audioNote: string | null
  outputDuration: number | null
  outputSize: string | null
}

declare global {
  interface Window {
    __spike?: SpikeResult | { error: string }
  }
}

export function VideoSpike() {
  const [log, setLog] = useState<string[]>([])
  const [frames, setFrames] = useState<ExtractedFrame[]>([])
  const [mp4Url, setMp4Url] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const add = (line: string) => setLog((l) => [...l, line])

  async function run(file: File) {
    setRunning(true)
    setLog([])
    setFrames([])
    setMp4Url(null)
    try {
      const info = await probeVideo(file)
      add(`probe: ${JSON.stringify(info)}`)
      const n = frameCount(info.duration, FPS)
      const timestamps = Array.from({ length: n }, (_, i) => frameTimestamp(i + 1, FPS))
      add(`extracting ${n} frames at ${FPS}fps…`)
      const t0 = performance.now()
      const extracted = await extractFrames(file, timestamps)
      const extractMs = Math.round(performance.now() - t0)
      setFrames(extracted)
      const frameBytes = extracted.reduce((s, f) => s + f.blob.size, 0)
      add(`extracted ${extracted.length} frames in ${extractMs}ms, ${(frameBytes / 1024).toFixed(0)} KB JPEG total`)

      add('encoding MP4 (avc) with audio copy…')
      const t1 = performance.now()
      const result = await encodeMp4({
        frames: extracted.map((f) => f.blob),
        fps: FPS,
        width: info.width,
        height: info.height,
        audioFrom: file,
      })
      const encodeMs = Math.round(performance.now() - t1)
      add(`encoded ${(result.blob.size / 1024).toFixed(0)} KB in ${encodeMs}ms, audioCopied=${result.audioCopied} ${result.audioNote ?? ''}`)
      const url = URL.createObjectURL(result.blob)
      setMp4Url(url)

      const meta = await new Promise<{ duration: number; size: string }>((resolve, reject) => {
        const v = document.createElement('video')
        v.preload = 'metadata'
        v.onloadedmetadata = () => resolve({ duration: v.duration, size: `${v.videoWidth}x${v.videoHeight}` })
        v.onerror = () => reject(new Error('video element could not load the MP4'))
        v.src = url
      })
      add(`output plays: duration=${meta.duration.toFixed(3)}s size=${meta.size}`)

      window.__spike = {
        info,
        frameCount: extracted.length,
        extractMs,
        actualTimestamps: extracted.map((f) => Number(f.actual.toFixed(4))),
        frameBytes,
        encodeMs,
        mp4Bytes: result.blob.size,
        audioCopied: result.audioCopied,
        audioNote: result.audioNote,
        outputDuration: meta.duration,
        outputSize: meta.size,
      }
    } catch (e) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      add(`ERROR ${msg}`)
      window.__spike = { error: msg }
    } finally {
      setRunning(false)
    }
  }

  async function runSample() {
    const res = await fetch(SAMPLE_URL)
    const blob = await res.blob()
    await run(new File([blob], 'sample-5s.mp4', { type: 'video/mp4' }))
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-lg font-semibold">Video spike (Issue 9)</h1>
      <div className="flex items-center gap-3">
        <button
          id="run-sample"
          type="button"
          disabled={running}
          onClick={runSample}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Run with fixtures/sample-5s.mp4
        </button>
        <label className="text-sm">
          or pick a file{' '}
          <input type="file" accept="video/*" disabled={running} onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} />
        </label>
      </div>
      <pre id="spike-log" className="whitespace-pre-wrap rounded bg-neutral-100 p-3 text-xs">
        {log.join('\n')}
      </pre>
      {frames.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {frames.map((f) => (
            <img key={f.index} src={URL.createObjectURL(f.blob)} alt={`frame ${f.index + 1}`} title={`t=${f.actual}`} className="h-16" />
          ))}
        </div>
      )}
      {mp4Url && <video id="spike-video" src={mp4Url} controls className="max-w-xl" />}
    </div>
  )
}
