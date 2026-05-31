import NodeID3 from 'node-id3'
import https from 'https'
import http from 'http'

export interface TrackMetadata {
  title: string
  artist: string
  album: string
  lyrics?: string
  trackNumber?: string
  year?: string
  thumbnailUrl?: string
  thumbBuf?: Buffer
}

function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    mod.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject)
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

/**
 * Write ID3 tags to an MP3 file.
 * Uses node-id3 to embed: Title, Artist, Album, UnsynchronisedLyrics.
 */
export async function writeID3Tags(filePath: string, meta: TrackMetadata): Promise<void> {
  const tags: NodeID3.Tags = {
    title: meta.title,
    artist: meta.artist,
    album: meta.album
  }

  if (meta.trackNumber) {
    tags.trackNumber = meta.trackNumber
  }

  if (meta.year) {
    tags.year = meta.year
  }

  if (meta.lyrics) {
    tags.unsynchronisedLyrics = {
      language: 'eng',
      text: meta.lyrics
    }
  }

  const imgBuf = meta.thumbBuf ?? (meta.thumbnailUrl ? await fetchBuffer(meta.thumbnailUrl).catch(() => null) : null)
  if (imgBuf) {
    tags.image = {
      mime: 'image/jpeg',
      type: { id: 3, name: 'front cover' },
      description: 'Cover',
      imageBuffer: imgBuf,
    }
  }

  const result = await NodeID3.Promise.write(tags, filePath)

  if (result instanceof Error) {
    throw result
  }
}
