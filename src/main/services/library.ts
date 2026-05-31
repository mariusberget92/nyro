import { createHash } from 'crypto'
import { readdirSync, statSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join, extname, basename, dirname } from 'path'
import NodeID3 from 'node-id3'
import type { LibraryTrack, LibraryScanResult } from '@shared/types/library'

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
      if (AUDIO_EXTS.has(ext) || VIDEO_EXTS.has(ext)) {
        files.push(full)
      }
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

function saveCover(coverData: Buffer, cacheDir: string, trackId: string): string | undefined {
  try {
    // If a manually-set PNG cover exists, preserve it instead of overwriting with the ID3 JPEG extract
    const pngPath = join(cacheDir, `${trackId}.png`)
    if (existsSync(pngPath)) return pngPath

    const coverPath = join(cacheDir, `${trackId}.jpg`)
    writeFileSync(coverPath, coverData)
    return coverPath
  } catch {
    return undefined
  }
}

async function processFile(filePath: string, outputFolder: string, cacheDir: string): Promise<LibraryTrack> {
  const id = createHash('md5').update(filePath).digest('hex')
  const ext = extname(filePath).toLowerCase()
  const source = sourceFromPath(filePath, outputFolder)

  if (AUDIO_EXTS.has(ext)) {
    try {
      const tags = await NodeID3.Promise.read(filePath)
      let coverPath: string | undefined
      const pic = (tags.image as any)
      if (pic && pic.imageBuffer) {
        coverPath = saveCover(pic.imageBuffer, cacheDir, id)
      }

      // Fall back to cover.jpg sidecar in the same folder if no embedded cover
      if (!coverPath) {
        const sideCover = join(dirname(filePath), 'cover.jpg')
        if (existsSync(sideCover)) coverPath = sideCover
      }

      const lrcPath = filePath.replace(/\.[^.]+$/, '.lrc')
      const resolvedLrcPath = existsSync(lrcPath) ? lrcPath : undefined

      // For podcasts, fall back to the immediate parent folder name (the show folder)
      // rather than "Unknown Album" so episodes always group under their show.
      const fallbackAlbum = source === 'podcast'
        ? basename(dirname(filePath))
        : 'Unknown Album'

      return {
        id,
        path: filePath,
        title: tags.title || basename(filePath, ext),
        artist: tags.artist || tags.performerInfo || 'Unknown Artist',
        album: tags.album || fallbackAlbum,
        year: tags.year ? parseInt(tags.year) : undefined,
        trackNumber: tags.trackNumber ? parseInt(tags.trackNumber) : undefined,
        genre: Array.isArray(tags.genre) ? tags.genre[0] : tags.genre,
        coverPath,
        lrcPath: resolvedLrcPath,
        source,
      } satisfies LibraryTrack
    } catch {
      const catchFallbackAlbum = source === 'podcast'
        ? basename(dirname(filePath))
        : 'Unknown Album'
      return {
        id, path: filePath,
        title: basename(filePath, ext),
        artist: 'Unknown Artist',
        album: catchFallbackAlbum,
        source,
      } satisfies LibraryTrack
    }
  }

  return {
    id, path: filePath,
    title: basename(filePath, ext),
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    source: 'video',
  } satisfies LibraryTrack
}

const BATCH = 5

export async function scanLibrary(outputFolder: string, cacheDir: string): Promise<LibraryScanResult> {
  mkdirSync(cacheDir, { recursive: true })
  const files = walkDir(outputFolder)
  const tracks: LibraryTrack[] = []

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(f => processFile(f, outputFolder, cacheDir)))
    tracks.push(...results)
    await new Promise<void>(res => setImmediate(res))
  }

  return { tracks, scannedAt: Date.now() }
}
