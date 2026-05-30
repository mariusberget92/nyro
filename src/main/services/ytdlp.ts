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
  playlist_title?: string
  playlist_id?: string
  release_year?: number
  release_date?: string
  upload_date?: string
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
function cookieArgs(cookiesFile?: string, cookiesBrowser?: string): string[] {
  if (cookiesFile) return ['--cookies', cookiesFile]
  if (cookiesBrowser) return ['--cookies-from-browser', cookiesBrowser]
  return []
}

export async function fetchMetadata(url: string, cookiesBrowser?: string, cookiesFile?: string): Promise<VideoMetadata[]> {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-download',
      '--flat-playlist',
      ...cookieArgs(cookiesFile, cookiesBrowser),
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
  mode?: 'audio' | 'video'
  videoQuality?: '4K' | '1080p' | '720p' | '480p'
  cookiesBrowser?: string
  cookiesFile?: string
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

function getVideoFormatArg(quality?: '4K' | '1080p' | '720p' | '480p'): string {
  switch (quality) {
    case '4K':    return 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best'
    case '720p':  return 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best'
    case '480p':  return 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best'
    case '1080p':
    default:      return 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best'
  }
}

/**
 * Download media from a URL using yt-dlp.
 * For mode 'audio': downloads best audio.
 * For mode 'video': downloads best video+audio and merges to mp4.
 * Reports progress 0-100 via onProgress.
 * Returns the path to the downloaded file.
 */
export function downloadMedia(opts: DownloadOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const { url, outputTemplate, mode = 'audio', videoQuality, cookiesBrowser, cookiesFile, onProgress, signal } = opts
    const cookiesArgs = cookieArgs(cookiesFile, cookiesBrowser)

    let args: string[]

    if (mode === 'video') {
      args = [
        '--format', getVideoFormatArg(videoQuality),
        '--merge-output-format', 'mp4',
        '--output', outputTemplate,
        '--no-playlist',
        '--progress',
        '--newline',
        ...cookiesArgs,
        url
      ]
    } else {
      args = [
        '--format', 'bestaudio',
        '--output', outputTemplate,
        '--no-playlist',
        '--progress',
        '--newline',
        ...cookiesArgs,
        url
      ]
    }

    let proc: ChildProcess | null = spawn(getYtdlpPath(), args, {
      stdio: ['pipe', 'pipe', 'pipe'],
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

/** Alias for backward compatibility */
export const downloadAudio = (opts: DownloadOptions) => downloadMedia({ ...opts, mode: 'audio' })
