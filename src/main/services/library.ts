import { createHash } from 'crypto'
import { readdirSync, existsSync, readFileSync } from 'fs'
import { join, extname, basename, dirname } from 'path'
import NodeID3 from 'node-id3'
import type Database from 'better-sqlite3'
import type { LibraryTrack, LibraryScanResult } from '@shared/types/library'
import { upsertTracksAndThumbs } from '../database/db'

const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.flac', '.ogg', '.wav', '.aac'])
const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.webm', '.mov'])

function walkDir(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(full, files)
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase()
      if (AUDIO_EXTS.has(ext) || VIDEO_EXTS.has(ext)) files.push(full)
    }
  }
  return files
}

function sourceFromPath(filePath: string, outputFolder: string): LibraryTrack['source'] {
  const rel = filePath.replace(outputFolder, '').replace(/\\/g, '/')
  if (rel.includes('/Podcasts/')) return 'podcast'
  const ext = extname(filePath).toLowerCase()
  if (VIDEO_EXTS.has(ext)) return 'video'
  return 'music'
}

type FileResult = {
  track: LibraryTrack
  thumbData?: Buffer
  thumbMime?: string
}

async function processFile(filePath: string, outputFolder: string): Promise<FileResult> {
  const id = createHash('md5').update(filePath).digest('hex')
  const ext = extname(filePath).toLowerCase()
  const source = sourceFromPath(filePath, outputFolder)

  if (AUDIO_EXTS.has(ext)) {
    try {
      const tags = await NodeID3.Promise.read(filePath)
      const lrcPath = filePath.replace(/\.[^.]+$/, '.lrc')
      const fallbackAlbum = source === 'podcast' ? basename(dirname(filePath)) : 'Unknown Album'

      let thumbData: Buffer | undefined
      let thumbMime = 'image/jpeg'
      const pic = tags.image as any
      if (pic?.imageBuffer) {
        thumbData = pic.imageBuffer as Buffer
        thumbMime = pic.mime ?? 'image/jpeg'
      } else {
        // Fall back to cover.jpg sidecar in album folder
        const sidecar = join(dirname(filePath), 'cover.jpg')
        if (existsSync(sidecar)) {
          try { thumbData = readFileSync(sidecar) } catch { /* non-fatal */ }
        }
      }

      const track: LibraryTrack = {
        id,
        path: filePath,
        title: tags.title || basename(filePath, ext),
        artist: tags.artist || tags.performerInfo || 'Unknown Artist',
        album: tags.album || fallbackAlbum,
        year: tags.year ? parseInt(tags.year) : undefined,
        trackNumber: tags.trackNumber ? parseInt(tags.trackNumber) : undefined,
        genre: Array.isArray(tags.genre) ? tags.genre[0] : tags.genre,
        coverPath: thumbData ? `nyro-thumb://${id}` : undefined,
        lrcPath: existsSync(lrcPath) ? lrcPath : undefined,
        source,
      }
      return { track, thumbData, thumbMime }
    } catch {
      const fallbackAlbum = source === 'podcast' ? basename(dirname(filePath)) : 'Unknown Album'
      return {
        track: { id, path: filePath, title: basename(filePath, ext), artist: 'Unknown Artist', album: fallbackAlbum, source },
      }
    }
  }

  return {
    track: { id, path: filePath, title: basename(filePath, ext), artist: 'Unknown Artist', album: 'Unknown Album', source },
  }
}

const BATCH = 5

export async function scanLibrary(outputFolder: string, db: Database.Database): Promise<LibraryScanResult> {
  const files = walkDir(outputFolder)
  const results: FileResult[] = []

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH)
    const batchResults = await Promise.all(batch.map(f => processFile(f, outputFolder)))
    results.push(...batchResults)
    await new Promise<void>(res => setImmediate(res))
  }

  const scannedAt = Date.now()
  upsertTracksAndThumbs(db, results.map(r => ({
    id: r.track.id,
    path: r.track.path,
    title: r.track.title,
    artist: r.track.artist,
    album: r.track.album,
    year: r.track.year,
    trackNumber: r.track.trackNumber,
    genre: r.track.genre,
    lrcPath: r.track.lrcPath,
    source: r.track.source,
    scannedAt,
    thumbData: r.thumbData,
    thumbMime: r.thumbMime,
  })))

  return { tracks: results.map(r => r.track), scannedAt }
}
