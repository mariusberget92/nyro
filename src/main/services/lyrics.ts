import https from 'https'
import { LRCLIB_API_BASE } from '@shared/constants'

interface LrclibResponse {
  id: number
  name: string
  trackName: string
  artistName: string
  albumName: string
  duration: number
  instrumental: boolean
  plainLyrics: string
  syncedLyrics: string
}

/**
 * Fetch lyrics from lrclib.net for a given artist and track.
 * Returns plain text lyrics or null if not found.
 */
export async function fetchLyrics(
  artistName: string,
  trackName: string,
  albumName?: string,
  duration?: number
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      artist_name: artistName,
      track_name: trackName
    })

    if (albumName) {
      params.set('album_name', albumName)
    }

    if (duration) {
      params.set('duration', String(Math.round(duration)))
    }

    const url = `${LRCLIB_API_BASE}/get?${params.toString()}`
    const data = await httpGet(url)

    if (!data) return null

    const parsed: LrclibResponse = JSON.parse(data)

    if (parsed.instrumental) return null

    return parsed.plainLyrics || null
  } catch {
    // Lyrics are best-effort; never fail the download
    return null
  }
}

function httpGet(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Nyro/1.0.0 (https://github.com/nyro-app/nyro)',
          Accept: 'application/json'
        }
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          resolve(null)
          return
        }

        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => (body += chunk))
        res.on('end', () => resolve(body))
        res.on('error', () => resolve(null))
      }
    )

    req.on('error', () => resolve(null))
    req.setTimeout(10000, () => {
      req.destroy()
      resolve(null)
    })
  })
}
