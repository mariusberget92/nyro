import { createHash } from 'crypto'
import { readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, extname, basename } from 'path'
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
      if (pic?.imageBuffer) {
        coverPath = saveCover(pic.imageBuffer, cacheDir, id)
      }
      const lrcPath = filePath.replace(/\.[^.]+$/, '.lrc')
      return {
        id, path: filePath,
        title: tags.title || basename(filePath, ext),
        artist: tags.artist || tags.performerInfo || 'Unknown Artist',
        album: tags.album || 'Unknown Album',
        year: tags.year ? parseInt(tags.year) : undefined,
        trackNumber: tags.trackNumber ? parseInt(tags.trackNumber) : undefined,
        genre: Array.isArray(tags.genre) ? tags.genre[0] : tags.genre,
        coverPath,
        lrcPath: existsSync(lrcPath) ? lrcPath : undefined,
        source,
      } satisfies LibraryTrack
    } catch {
      return {
        id, path: filePath,
        title: basename(filePath, ext),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
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

// Async scan that yields the main thread between each file so IPC stays responsive
export async function scanLibrary(outputFolder: string, cacheDir: string): Promise<LibraryScanResult> {
  mkdirSync(cacheDir, { recursive: true })
  const files = walkDir(outputFolder)
  const tracks: LibraryTrack[] = []

  // Process files concurrently in small batches so NodeID3 async reads
  // don't queue up and still yield the event loop between batches
  const BATCH = 5
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(f => processFile(f, outputFolder, cacheDir)))
    tracks.push(...results)
    await new Promise<void>(res => setImmediate(res))
  }

  return { tracks, scannedAt: Date.now() }
}
