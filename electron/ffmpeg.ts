import { spawn } from 'child_process'
import { readFileSync, writeFileSync, appendFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const LOG_PATH = '/tmp/vibe-movie-export.log'

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  process.stdout.write(line)
  appendFileSync(LOG_PATH, line)
}

function resolveBinary(pkg: string, subPath: string): string {
  let base = require.resolve(`${pkg}/package.json`)
  base = base.replace('package.json', '')
  if (app.isPackaged) {
    base = base.replace('app.asar', 'app.asar.unpacked')
  }
  return join(base, subPath)
}

function getFFmpegPath(): string {
  try {
    // ffmpeg-static exports the path directly
    let p = require('ffmpeg-static') as string
    if (app.isPackaged) {
      p = p.replace('app.asar', 'app.asar.unpacked')
    }
    return p
  } catch {
    return resolveBinary('ffmpeg-static', 'ffmpeg')
  }
}

function getFFprobePath(): string {
  try {
    const ffprobeStatic = require('ffprobe-static') as { path: string }
    let p = ffprobeStatic.path
    if (app.isPackaged) {
      p = p.replace('app.asar', 'app.asar.unpacked')
    }
    return p
  } catch {
    return resolveBinary('ffprobe-static', 'bin/darwin/x64/ffprobe')
  }
}

export function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = getFFmpegPath()
    log('[ffmpeg] ' + args.join(' '))
    const proc = spawn(ffmpeg, args)
    let stderr = ''
    proc.stdout.resume() // drain stdout to prevent pipe deadlock
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) {
        log('[ffmpeg] done: ' + args[args.length - 1])
        resolve()
      } else {
        log('[ffmpeg] FAILED: ' + stderr.slice(-500))
        reject(new Error(`FFmpeg exited with code ${code}\n${stderr}`))
      }
    })
    proc.on('error', reject)
  })
}

export function runFFmpegWithProgress(
  args: string[],
  totalDuration: number,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = getFFmpegPath()
    log('[ffmpeg:progress] ' + args.join(' '))
    const proc = spawn(ffmpeg, args)
    let stdout = ''
    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString()
      const match = stdout.match(/out_time_us=(\d+)/)
      if (match) {
        const us = parseInt(match[1], 10)
        const pct = Math.min((us / 1e6 / totalDuration) * 100, 100)
        onProgress(pct)
        stdout = ''
      }
    })
    proc.stderr.resume() // drain stderr to prevent pipe deadlock
    proc.on('close', (code) => {
      if (code === 0) {
        log('[ffmpeg:progress] done')
        resolve()
      } else {
        log('[ffmpeg:progress] FAILED code=' + code)
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })
    proc.on('error', reject)
  })
}

export async function getKeyframes(videoPath: string): Promise<number[]> {
  return new Promise((resolve) => {
    const ffprobe = getFFprobePath()
    const proc = spawn(ffprobe, [
      '-v', 'quiet',
      '-select_streams', 'v:0',
      '-show_packets',
      '-show_entries', 'packet=pts_time,flags',
      '-of', 'csv=p=0',
      videoPath
    ])
    let stdout = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.resume()
    proc.on('close', () => {
      const keyframes: number[] = []
      for (const line of stdout.split('\n')) {
        const [pts, flags] = line.split(',')
        if (flags?.includes('K') && pts) {
          const t = parseFloat(pts)
          if (!isNaN(t)) keyframes.push(t)
        }
      }
      resolve(keyframes.sort((a, b) => a - b))
    })
    proc.on('error', () => resolve([]))
  })
}

export async function generateThumbnail(videoPath: string): Promise<string> {
  // First get duration to calculate 10% mark
  const meta = await getVideoMetadata(videoPath)
  const seekTime = meta.duration * 0.1

  const tmpPath = `/tmp/vibe_thumb_${Date.now()}.png`
  await runFFmpeg([
    '-ss', String(seekTime),
    '-i', videoPath,
    '-vframes', '1',
    '-vf', 'scale=160:-1',
    '-y', tmpPath
  ])

  const data = readFileSync(tmpPath)
  const b64 = data.toString('base64')
  try { unlinkSync(tmpPath) } catch { /* ignore */ }
  return `data:image/png;base64,${b64}`
}

export async function getVideoMetadata(
  videoPath: string
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const ffprobe = getFFprobePath()
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      videoPath
    ]
    const proc = spawn(ffprobe, args)
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed: ${stderr}`))
        return
      }
      try {
        const data = JSON.parse(stdout)
        const videoStream = data.streams?.find(
          (s: { codec_type: string }) => s.codec_type === 'video'
        )
        const duration = parseFloat(data.format?.duration || '0')
        const width = videoStream?.width || 0
        const height = videoStream?.height || 0
        resolve({ duration, width, height })
      } catch (e) {
        reject(new Error(`Failed to parse ffprobe output: ${e}`))
      }
    })
    proc.on('error', reject)
  })
}

// Use transpose filter (optimized for 90° steps) instead of rotate
// transpose=1: 90° CW, transpose=2: 90° CCW, hflip+vflip: 180°
function rotationFilter(deg: number): string {
  if (deg === 90)  return 'transpose=1'
  if (deg === 180) return 'hflip,vflip'
  if (deg === 270) return 'transpose=2'
  return 'copy'
}

export async function exportVideo(
  clips: Array<{ videoPath: string; start: number; end: number; rotation: number }>,
  outputPath: string,
  onProgress: (pct: number) => void
): Promise<void> {
  const totalDuration = clips.reduce((sum, c) => sum + (c.end - c.start), 0)
  const needsReencode = clips.some((c) => c.rotation !== 0)
  const ts = Date.now()
  const concatList = `/tmp/vibe_concat_${ts}.txt`

  if (!needsReencode) {
    // Fast path: keyframe-accurate stream copy.
    // -ss before -i = fast seek, rounds start BACK to nearest keyframe (starts early).
    // -to before -i = reads until that time, rounds end FORWARD to next keyframe (ends late).
    // Per-segment temp files reset timestamps, eliminating A/V desync.
    const tmpFiles: string[] = new Array(clips.length)
    try {
      let completed = 0
      const queue = clips.map((_, i) => i)
      const workers = Array.from({ length: Math.min(4, clips.length) }, async () => {
        while (queue.length > 0) {
          const i = queue.shift()!
          const clip = clips[i]
          const tmpOut = `/tmp/vibe_seg_${ts}_${i}.mp4`
          tmpFiles[i] = tmpOut
          await runFFmpeg([
            '-ss', String(clip.start),
            '-to', String(clip.end),
            '-i', clip.videoPath,
            '-c', 'copy',
            '-avoid_negative_ts', 'make_zero',
            '-y', tmpOut
          ])
          completed++
          onProgress((completed / clips.length) * 50)
        }
      })
      await Promise.all(workers)

      writeFileSync(concatList, tmpFiles.map((f) => `file '${f}'`).join('\n'))
      await runFFmpegWithProgress(
        [
          '-f', 'concat', '-safe', '0',
          '-i', concatList,
          '-c', 'copy',
          '-progress', 'pipe:1',
          '-y', outputPath
        ],
        totalDuration,
        onProgress
      )
    } finally {
      for (const f of tmpFiles) {
        try { if (existsSync(f)) unlinkSync(f) } catch { /* ignore */ }
      }
      try { unlinkSync(concatList) } catch { /* ignore */ }
    }
    return
  }

  // Rotation path: re-encode clips with VideoToolbox (hardware) in parallel,
  // then concat. Concurrency capped at 4 to avoid I/O contention.
  const CONCURRENCY = 4
  const tmpFiles: string[] = new Array(clips.length)
  let completed = 0
  try {
    async function encodeClip(i: number): Promise<void> {
      const clip = clips[i]
      const tmpOut = `/tmp/vibe_seg_${ts}_${i}.mp4`
      tmpFiles[i] = tmpOut

      const baseArgs = [
        '-ss', String(clip.start),
        '-to', String(clip.end),
        '-i', clip.videoPath
      ]

      if (clip.rotation !== 0) {
        const vf = rotationFilter(clip.rotation)
        try {
          log(`[export] clip ${i}: VideoToolbox encode (rotation=${clip.rotation})`)
          await runFFmpeg([
            ...baseArgs,
            '-vf', vf, '-metadata:s:v', 'rotate=0',
            '-c:v', 'h264_videotoolbox', '-b:v', '8000k',
            '-pix_fmt', 'yuv420p', '-c:a', 'aac',
            '-y', tmpOut
          ])
          log(`[export] clip ${i}: VideoToolbox succeeded`)
        } catch (e) {
          log(`[export] clip ${i}: VideoToolbox failed (${e}), falling back to libx264`)
          await runFFmpeg([
            ...baseArgs,
            '-vf', vf, '-metadata:s:v', 'rotate=0',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac',
            '-y', tmpOut
          ])
        }
      } else {
        log(`[export] clip ${i}: stream copy (no rotation)`)
        await runFFmpeg([...baseArgs, '-c', 'copy', '-y', tmpOut])
      }

      completed++
      log(`[export] clip ${i} complete (${completed}/${clips.length})`)
      onProgress((completed / clips.length) * 50)
    }

    // Run with bounded concurrency
    const queue = clips.map((_, i) => i)
    const workers = Array.from({ length: Math.min(CONCURRENCY, clips.length) }, async () => {
      while (queue.length > 0) {
        const i = queue.shift()!
        await encodeClip(i)
      }
    })
    await Promise.all(workers)

    writeFileSync(concatList, tmpFiles.map((f) => `file '${f}'`).join('\n'))

    await runFFmpegWithProgress(
      [
        '-f', 'concat', '-safe', '0',
        '-i', concatList,
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-progress', 'pipe:1',
        '-y', outputPath
      ],
      totalDuration,
      (pct) => onProgress(50 + pct * 0.5)
    )
  } finally {
    for (const f of tmpFiles) {
      try { if (existsSync(f)) unlinkSync(f) } catch { /* ignore */ }
    }
    try { if (existsSync(concatList)) unlinkSync(concatList) } catch { /* ignore */ }
  }
}
