import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { YTDLP_BINARY } from '@shared/constants'

let ytdlpPath: string | null = null

export function getYtdlpPath(): string {
  if (ytdlpPath) return ytdlpPath

  const resourcesDir = app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), 'resources')
  const bundled = join(resourcesDir, YTDLP_BINARY)
  if (existsSync(bundled)) {
    ytdlpPath = bundled
    return ytdlpPath
  }

  ytdlpPath = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  return ytdlpPath
}

export interface VideoMetadata {
  id: string
  title: string
  uploader: string
  album?: string
  duration: number
  thumbnail?: string
  webpage_url: string
  entries?: VideoMetadata[]
  _type?: string
}

/**
 * Fetch metadata for a YouTube URL using yt-dlp --dump-json.
 * Returns an array of VideoMetadata (multiple items for playlists).
 */
export async function fetchMetadata(url: string): Promise<VideoMetadata[]> {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-download',
      '--flat-playlist',
      url
    ]

    let stdout = ''
    let stderr = ''

    const proc = spawn(getYtdlpPath(), args, { stdio: ['pipe', 'pipe', 'pipe'] })

    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (data: string) => (stdout += data))

    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (data: string) => (stderr += data))

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp metadata fetch failed: ${stderr.slice(0, 500)}`))
        return
      }

      try {
        const lines = stdout.trim().split('\n').filter(Boolean)
        const items: VideoMetadata[] = lines.map((line) => JSON.parse(line))
        resolve(items)
      } catch (err) {
        reject(new Error(`Failed to parse yt-dlp output: ${err}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`))
    })
  })
}

export interface DownloadOptions {
  url: string
  outputTemplate: string
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

/**
 * Download best audio from a YouTube URL using yt-dlp.
 * Reports progress 0-100 via onProgress.
 * Returns the path to the downloaded file.
 */
export function downloadAudio(opts: DownloadOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const { url, outputTemplate, onProgress, signal } = opts

    const args = [
      '--format', 'bestaudio',
      '--output', outputTemplate,
      '--no-playlist',
      '--progress',
      '--newline',
      url
    ]

    let proc: ChildProcess | null = spawn(getYtdlpPath(), args, {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let downloadedFile = ''
    let stderr = ''

    const cleanup = () => {
      if (proc) {
        proc.kill('SIGKILL')
        proc = null
      }
    }

    signal?.addEventListener('abort', cleanup)

    if (proc.stdout) {
      proc.stdout.setEncoding('utf8')
      proc.stdout.on('data', (data: string) => {
        const lines = data.split('\n')
        for (const line of lines) {
          // Parse progress: [download]  xx.x% of ...
          const progressMatch = line.match(/\[download\]\s+([\d.]+)%/)
          if (progressMatch && onProgress) {
            const pct = Math.round(parseFloat(progressMatch[1]))
            onProgress(Math.min(99, pct))
          }

          // Parse destination filename
          const destMatch = line.match(/\[download\] Destination: (.+)/)
          if (destMatch) {
            downloadedFile = destMatch[1].trim()
          }

          // Already downloaded
          const alreadyMatch = line.match(/\[download\] (.+) has already been downloaded/)
          if (alreadyMatch) {
            downloadedFile = alreadyMatch[1].trim()
          }
        }
      })
    }

    if (proc.stderr) {
      proc.stderr.setEncoding('utf8')
      proc.stderr.on('data', (data: string) => (stderr += data))
    }

    proc.on('close', (code) => {
      signal?.removeEventListener('abort', cleanup)
      if (signal?.aborted) {
        reject(new Error('Download cancelled'))
        return
      }
      if (code === 0) {
        onProgress?.(100)
        resolve(downloadedFile)
      } else {
        reject(new Error(`yt-dlp download failed (code ${code}): ${stderr.slice(0, 500)}`))
      }
    })

    proc.on('error', (err) => {
      signal?.removeEventListener('abort', cleanup)
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`))
    })
  })
}
