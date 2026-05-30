import https from 'https'
import fs from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'
import { app } from 'electron'
import { YTDLP_BINARY, FFMPEG_BINARY } from '@shared/constants'
import { getYtdlpPath } from './ytdlp'
import { getFFmpegPath } from './ffmpeg'

export interface BinaryStatus {
  found: boolean
  current: string | null
  latest: string | null
  needsUpdate: boolean
}

export interface UpdaterResult {
  ytdlp: BinaryStatus
  ffmpeg: BinaryStatus
  ytdlpUpdated: boolean
}

function runCommand(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 10000 }, (err, stdout) => {
      resolve(err ? '' : stdout.trim())
    })
  })
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Nyro/1.0.0',
        Accept: 'application/json'
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        res.resume()
        return httpsGet(res.headers.location!).then(resolve).catch(reject)
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (c: string) => (body += c))
      res.on('end', () => resolve(body))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string) => {
      https.get(u, { headers: { 'User-Agent': 'Nyro/1.0.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          res.resume()
          follow(res.headers.location!)
          return
        }
        const tmp = dest + '.tmp'
        const out = fs.createWriteStream(tmp)
        res.pipe(out)
        out.on('finish', () => {
          out.close(() => {
            try {
              if (fs.existsSync(dest)) fs.unlinkSync(dest)
              fs.renameSync(tmp, dest)
              if (process.platform !== 'win32') {
                fs.chmodSync(dest, 0o755)
              }
              resolve()
            } catch (e) { reject(e) }
          })
        })
        out.on('error', (e) => { fs.unlink(tmp, () => {}); reject(e) })
      }).on('error', reject)
    }
    follow(url)
  })
}

async function getYtdlpLatest(): Promise<string | null> {
  try {
    const json = await httpsGet('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest')
    const data = JSON.parse(json)
    return (data.tag_name as string) ?? null
  } catch {
    return null
  }
}

function getYtdlpDownloadUrl(version: string): string {
  const base = `https://github.com/yt-dlp/yt-dlp/releases/download/${version}`
  if (process.platform === 'win32') return `${base}/yt-dlp.exe`
  if (process.platform === 'darwin') return `${base}/yt-dlp_macos`
  return `${base}/yt-dlp`
}

function resourcesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), 'resources')
}

export async function checkAndUpdate(
  onProgress: (msg: string) => void
): Promise<UpdaterResult> {
  // ── yt-dlp ───────────────────────────────────────────────────────────────
  const ytdlpBin = getYtdlpPath()
  const ytdlpFound = fs.existsSync(ytdlpBin)

  let ytdlpCurrent: string | null = null
  let ytdlpLatest: string | null = null
  let ytdlpUpdated = false

  if (ytdlpFound) {
    ytdlpCurrent = await runCommand(ytdlpBin, ['--version'])
    onProgress(`yt-dlp current: ${ytdlpCurrent || 'unknown'}`)
  } else {
    onProgress('yt-dlp not found in resources folder')
  }

  try {
    ytdlpLatest = await getYtdlpLatest()
  } catch {
    onProgress('Could not reach GitHub to check yt-dlp version')
  }

  const ytdlpNeedsUpdate = !!ytdlpLatest &&
    !!ytdlpCurrent &&
    ytdlpLatest.replace(/^v/, '') !== ytdlpCurrent.replace(/^v/, '')

  if (ytdlpNeedsUpdate || (!ytdlpFound && ytdlpLatest)) {
    onProgress(`Updating yt-dlp to ${ytdlpLatest}…`)
    try {
      const destDir = resourcesDir()
      fs.mkdirSync(destDir, { recursive: true })
      const dest = join(destDir, YTDLP_BINARY)
      const url = getYtdlpDownloadUrl(ytdlpLatest!)
      await downloadFile(url, dest)
      // Re-read version from freshly downloaded binary
      ytdlpCurrent = await runCommand(dest, ['--version'])
      ytdlpUpdated = true
      onProgress(`yt-dlp updated to ${ytdlpCurrent}`)
    } catch (e) {
      onProgress(`yt-dlp update failed: ${e}`)
    }
  } else if (ytdlpFound && ytdlpCurrent && ytdlpLatest &&
    ytdlpLatest.replace(/^v/, '') === ytdlpCurrent.replace(/^v/, '')) {
    onProgress('yt-dlp is up to date')
  }

  // ── FFmpeg ────────────────────────────────────────────────────────────────
  const ffmpegBin = getFFmpegPath()
  const ffmpegFound = fs.existsSync(ffmpegBin)
  let ffmpegCurrent: string | null = null

  if (ffmpegFound) {
    const raw = await runCommand(ffmpegBin, ['-version'])
    const m = raw.match(/ffmpeg version ([^\s]+)/)
    ffmpegCurrent = m ? m[1] : raw.split('\n')[0] || 'unknown'
    onProgress(`FFmpeg: ${ffmpegCurrent}`)
  } else {
    onProgress('FFmpeg not found in resources folder')
  }

  return {
    ytdlp: {
      found: ytdlpFound || ytdlpUpdated,
      current: ytdlpCurrent,
      latest: ytdlpLatest,
      needsUpdate: ytdlpNeedsUpdate && !ytdlpUpdated,
    },
    ffmpeg: {
      found: ffmpegFound,
      current: ffmpegCurrent,
      latest: null,     // no auto-update for FFmpeg
      needsUpdate: false,
    },
    ytdlpUpdated,
  }
}
