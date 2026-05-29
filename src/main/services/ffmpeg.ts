import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { FFMPEG_BINARY } from '@shared/constants'

let ffmpegPath: string | null = null

export function getFFmpegPath(): string {
  if (ffmpegPath) return ffmpegPath

  // Check bundled binary first
  const resourcesPath = process.resourcesPath || join(app.getAppPath(), '..', 'resources')
  const bundled = join(resourcesPath, 'resources', FFMPEG_BINARY)
  if (existsSync(bundled)) {
    ffmpegPath = bundled
    return ffmpegPath
  }

  // Fall back to system binary
  ffmpegPath = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  return ffmpegPath
}

export interface ConvertOptions {
  inputPath: string
  outputPath: string
  bitrate?: '320' | '256' | '192' | '128'
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

/**
 * Convert an audio file to MP3 using FFmpeg.
 * Reports progress as 0–100.
 */
export function convertToMp3(opts: ConvertOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const { inputPath, outputPath, bitrate = '320', onProgress, signal } = opts

    const args = [
      '-y',
      '-i', inputPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-b:a', `${bitrate}k`,
      '-id3v2_version', '3',
      outputPath
    ]

    let proc: ChildProcess | null = spawn(getFFmpegPath(), args, { stdio: ['pipe', 'pipe', 'pipe'] })

    let totalDuration = 0

    const cleanup = () => {
      if (proc) {
        proc.kill('SIGKILL')
        proc = null
      }
    }

    signal?.addEventListener('abort', cleanup)

    if (proc.stderr) {
      proc.stderr.setEncoding('utf8')
      proc.stderr.on('data', (data: string) => {
        // Parse duration
        const durationMatch = data.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
        if (durationMatch) {
          const hours = parseInt(durationMatch[1])
          const minutes = parseInt(durationMatch[2])
          const seconds = parseFloat(durationMatch[3])
          totalDuration = hours * 3600 + minutes * 60 + seconds
        }

        // Parse current time for progress
        const timeMatch = data.match(/time=(\d+):(\d+):(\d+\.\d+)/)
        if (timeMatch && totalDuration > 0 && onProgress) {
          const hours = parseInt(timeMatch[1])
          const minutes = parseInt(timeMatch[2])
          const seconds = parseFloat(timeMatch[3])
          const currentTime = hours * 3600 + minutes * 60 + seconds
          const percent = Math.min(100, Math.round((currentTime / totalDuration) * 100))
          onProgress(percent)
        }
      })
    }

    proc.on('close', (code) => {
      signal?.removeEventListener('abort', cleanup)
      if (signal?.aborted) {
        reject(new Error('Conversion cancelled'))
        return
      }
      if (code === 0) {
        onProgress?.(100)
        resolve()
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })

    proc.on('error', (err) => {
      signal?.removeEventListener('abort', cleanup)
      reject(err)
    })
  })
}
