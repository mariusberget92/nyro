import https from 'https'
import http from 'http'
import { createWriteStream } from 'fs'

export interface HttpDownloadOptions {
  url: string
  outputPath: string
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

export function httpDownload(opts: HttpDownloadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const { url, outputPath, onProgress, signal } = opts

    const protocol = url.startsWith('https') ? https : http
    const req = protocol.get(url, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        const location = res.headers.location
        if (location) {
          httpDownload({ url: location, outputPath, onProgress, signal }).then(resolve).catch(reject)
          return
        }
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP download failed: ${res.statusCode}`))
        return
      }

      const total = parseInt(res.headers['content-length'] || '0', 10)
      let received = 0
      const file = createWriteStream(outputPath)

      signal?.addEventListener('abort', () => {
        req.destroy()
        file.destroy()
        reject(new Error('Download cancelled'))
      })

      res.on('data', (chunk: Buffer) => {
        received += chunk.length
        if (total > 0 && onProgress) {
          onProgress(Math.round((received / total) * 100))
        }
      })

      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
      file.on('error', reject)
      res.on('error', reject)
    })

    req.on('error', reject)
  })
}
