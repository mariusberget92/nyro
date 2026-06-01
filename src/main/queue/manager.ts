import { BrowserWindow } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync, renameSync, unlinkSync, copyFileSync, writeFileSync } from 'fs'
import https from 'https'
import http from 'http'
import { tmpdir } from 'os'
import { v4 as uuidv4 } from 'uuid'
import type { QueueItem, QueueStatus } from '@shared/types/queue'
import { IPC_CHANNELS, YOUTUBE_URL_PATTERNS } from '@shared/constants'
import { fetchMetadata, downloadMedia } from '../services/ytdlp'
import { convertToMp3 } from '../services/ffmpeg'
import { writeID3Tags } from '../services/metadata'
import { fetchLyrics } from '../services/lyrics'
import { buildFilename, sanitizeFilenameComponent } from '../services/filename'
import { loadQueue, saveQueue, loadSettings } from '../storage/store'
import { httpDownload } from '../services/httpDownload'
import { getEpisode } from '../services/taddy'

function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    mod.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location as string).then(resolve).catch(reject)
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}


function resolveOutputPath(item: QueueItem, settings: ReturnType<typeof loadSettings>): string | null {
  const meta = item.metadata
  if (!meta) return null

  const baseFolder = item.outputFolder || settings.outputFolder
  const isVideo = item.downloadMode === 'video'
  const ext = isVideo ? 'mp4' : 'mp3'

  if (isVideo) {
    const filename = buildFilename({ title: meta.title, artist: meta.artist, settings })
    return join(baseFolder, 'Videos', `${filename}.${ext}`)
  }

  let targetFolder = baseFolder
  const effectiveAlbum = item.albumOverride || meta.album
  if (effectiveAlbum) {
    const safeAlbum = sanitizeFilenameComponent(effectiveAlbum)
    const folderName = meta.year ? `${safeAlbum} (${meta.year})` : safeAlbum
    targetFolder = join(baseFolder, 'Albums', folderName)
  } else if (item.playlistTitle) {
    targetFolder = join(baseFolder, 'Playlists', sanitizeFilenameComponent(item.playlistTitle))
  } else {
    const uploaderName = cleanUploader((meta as any).uploader || '')
    if (uploaderName) targetFolder = join(baseFolder, 'Artists', sanitizeFilenameComponent(uploaderName))
  }

  const filename = buildFilename({ title: meta.title, artist: meta.artist, settings })
  return join(targetFolder, `${filename}.${ext}`)
}

function moveFile(src: string, dest: string): void {
  try {
    renameSync(src, dest)
  } catch (err: any) {
    if (err.code === 'EXDEV') {
      copyFileSync(src, dest)
      unlinkSync(src)
    } else {
      throw err
    }
  }
}

function cleanUploader(uploader?: string): string {
  if (!uploader) return ''
  return uploader.replace(/\s*-\s*Topic$/i, '').trim()
}

// Noise phrases stripped from YouTube/SoundCloud titles — order matters (most specific first)
const TITLE_NOISE = [
  // Bracketed / parenthesised blocks containing noise keywords
  /\s*[\[(（][^\]）)]*?\b(?:official\s*(?:music\s*)?video|official\s*audio|official\s*lyric\s*video|official\s*visualizer|official\s*clip|official\s*performance|official\s*live)\b[^\]）)]*?[\]）)]/gi,
  /\s*[\[(（][^\]）)]*?\b(?:music\s*video|lyric\s*video|lyrics?\s*video|animated\s*video|visuali[sz]er|audio\s*only|full\s*video)\b[^\]）)]*?[\]）)]/gi,
  /\s*[\[(（][^\]）)]*?\b(?:4k|2160p|1440p|1080p|720p|480p|360p|hd|fhd|uhd|hdr|60\s*fps|high\s*quality)\b[^\]）)]*?[\]）)]/gi,
  /\s*[\[(（][^\]）)]*?\b(?:explicit|clean\s*version|radio\s*edit|single\s*version|album\s*version|deluxe\s*version|extended\s*version|extended\s*mix|original\s*mix|remaster(?:ed)?|re-?master(?:ed)?)\b[^\]）)]*?[\]）)]/gi,
  /\s*[\[(（][^\]）)]*?\b(?:lyrics?|subtitles?|sub(?:titled)?|cc|auto-?generated|auto\s*generated)\b[^\]）)]*?[\]）)]/gi,
  /\s*[\[(（][^\]）)]*?\b(?:live|live\s*at|live\s*from|live\s*performance|acoustic|unplugged|session|studio\s*session|live\s*session)\b[^\]）)]*?[\]）)]/gi,
  /\s*[\[(（][^\]）)]*?\b(?:mv|m\/v|pv|p\/v|ncs\s*release|no\s*copyright|free\s*download)\b[^\]）)]*?[\]）)]/gi,
  // Bare bracketed blocks with only very short noise content like [HD], [4K], (Official)
  /\s*[\[(（]\s*(?:hd|4k|uhd|fhd|official|explicit|mv|ncs)\s*[\]）)]/gi,
  // Scene/genre tags in brackets: [FREE], [wave/phonk], [nightdrive], [lofi], [type beat], etc.
  /\s*\[[^\]]*?\b(?:free|type\s*beat|wave|phonk|nightdrive|lofi|lo-?fi|drill|trap|rage|pluggnb|plugg|hyperpop|emo\s*rap|dark\s*trap|cloud\s*rap|bedroom\s*pop|vaporwave|synthwave|darkwave|chillwave|shoegaze|ambient)\b[^\]]*?\]/gi,
  // Standalone [FREE] or [FREE BEAT] at start or anywhere
  /\s*\[FREE[^\]]*?\]/gi,
  // Remix/version credits in parens that aren't featuring: (X Remix), (X REMIX), (X Edit), (X Flip)
  /\s*\([^)]*?\b(?:remix|bootleg|edit|flip|rework|mashup|re-?mix)\b[^)]*?\)/gi,
  // Trailing unbracketed noise after a pipe or em-dash
  /\s*[|｜]\s*.{0,80}$/g,
  // "ft." / "feat." featuring credit — keep it on title but normalise later (don't strip)
]

function parseArtistTitle(videoTitle: string): { artist: string; title: string } {
  let cleaned = videoTitle
  for (const re of TITLE_NOISE) {
    cleaned = cleaned.replace(re, '')
  }
  cleaned = cleaned.trim()

  // Split on " - " or " – " (en-dash) separators
  const sep = /\s+[-–]\s+/
  const idx = cleaned.search(sep)
  if (idx > 0) {
    const artist = cleaned.slice(0, idx).trim()
    const title = cleaned.slice(idx).replace(sep, '').trim()
    return { artist, title }
  }

  // No separator — put everything in title, leave artist blank
  return { artist: '', title: cleaned || videoTitle }
}

type ProgressCallback = (id: string, progress: number, status: QueueStatus) => void

class QueueManager {
  private queue: QueueItem[] = []
  private isPaused = false
  private isProcessing = false
  private currentAbortController: AbortController | null = null
  private window: BrowserWindow | null = null

  // Throttle IPC progress per item: track last-sent time
  private lastProgressSent = new Map<string, number>()
  // Debounce disk writes
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.queue = loadQueue()
    // Reset in-flight items to pending on startup
    this.queue = this.queue.map((item) => {
      if (['fetching', 'downloading', 'converting', 'tagging'].includes(item.status)) {
        return { ...item, status: 'pending' as QueueStatus, progress: 0 }
      }
      return item
    })
    saveQueue(this.queue)
  }

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  getQueue(): QueueItem[] {
    return [...this.queue]
  }

  async addPodcastEpisode(episodeId: string, outputFolder?: string, showName?: string): Promise<QueueItem> {
    const settings = loadSettings()
    if (!settings.taddyUserId || !settings.taddyApiKey) throw new Error('Taddy credentials not set')
    const ep = await getEpisode(episodeId, settings.taddyUserId, settings.taddyApiKey)
    const item: QueueItem = {
      id: uuidv4(),
      url: ep.audioUrl,
      source: 'podcast',
      status: 'pending',
      progress: 0,
      addedAt: Date.now(),
      metadata: {
        title: ep.name,
        artist: showName || '',
        album: showName || '',
        duration: ep.duration,
        thumbnailUrl: ep.imageUrl,
        videoId: ep.uuid,
        audioUrl: ep.audioUrl,
        podcastShow: showName,
      }
    }
    if (outputFolder) item.outputFolder = outputFolder
    this.queue.push(item)
    this.schedulePersist()
    this.emitStatusChanged(item.id, 'pending')
    return item
  }

  async addUrl(url: string, outputFolder?: string, albumOverride?: string): Promise<QueueItem[]> {
    if (!this.isValidYouTubeUrl(url)) {
      throw new Error('Invalid URL')
    }

    if (this.isYouTubeRadioMix(url)) {
      throw new Error(
        'This is a YouTube Radio/Mix playlist (list=RD…) which auto-generates hundreds of songs.\n' +
        'For albums, use a YouTube Music link instead:\n' +
        'music.youtube.com/playlist?list=OLAK5uy_…'
      )
    }

    const settings = loadSettings()

    // Create a placeholder item while fetching metadata
    const placeholderId = uuidv4()
    const placeholder: QueueItem = {
      id: placeholderId,
      url,
      status: 'fetching',
      progress: 0,
      addedAt: Date.now()
    }

    this.queue.push(placeholder)
    this.schedulePersist()
    this.emitStatusChanged(placeholderId, 'fetching')

    let metadataList
    try {
      metadataList = await fetchMetadata(url, settings.cookiesBrowser || undefined, settings.cookiesFile || undefined)
    } catch (err) {
      this.updateItem(placeholderId, { status: 'failed', error: String(err) })
      throw err
    }

    // Remove placeholder
    this.queue = this.queue.filter((i) => i.id !== placeholderId)

    // Detect playlist: more than one item, or first item has a playlist_title
    const playlistTitle = metadataList.length > 1
      ? (metadataList[0].playlist_title || null)
      : null

    const newItems: QueueItem[] = metadataList.map((meta) => {
      const year = meta.release_year
        ?? (meta.release_date ? parseInt(meta.release_date.substring(0, 4)) : undefined)
        ?? (meta.upload_date ? parseInt(meta.upload_date.substring(0, 4)) : undefined)

      const { artist, title } = parseArtistTitle(meta.title || '')
      // Prefer an explicit album tag; fall back to playlist title or channel name
      const album = meta.album
        || playlistTitle
        || cleanUploader(meta.uploader)
        || ''

      return {
        id: uuidv4(),
        url: meta.webpage_url || url,
        status: 'pending' as QueueStatus,
        progress: 0,
        addedAt: Date.now(),
        downloadMode: settings.downloadMode,
        playlistTitle: playlistTitle ?? undefined,
        outputFolder: outputFolder || undefined,
        albumOverride: albumOverride || undefined,
        metadata: {
          title: title || meta.title || 'Unknown Title',
          artist: artist || cleanUploader(meta.uploader) || 'Unknown Artist',
          album,
          year: isNaN(year as number) ? undefined : year,
          duration: meta.duration || 0,
          thumbnailUrl: meta.thumbnail,
          videoId: meta.id
        }
      }
    })

    this.queue.push(...newItems)
    this.schedulePersist()

    for (const item of newItems) {
      this.emitStatusChanged(item.id, 'pending')
    }

    return newItems
  }

  removeItem(id: string): void {
    const item = this.queue.find((i) => i.id === id)
    if (item && ['downloading', 'converting', 'tagging', 'fetching'].includes(item.status)) {
      const ctrl = this.currentAbortController
      if (ctrl) ctrl.abort()
    }
    this.queue = this.queue.filter((i) => i.id !== id)
    this.lastProgressSent.delete(id)
    this.flushPersist()
  }

  async start(): Promise<void> {
    this.isPaused = false
    if (!this.isProcessing) {
      await this.processNext()
    }
  }

  pause(): void {
    this.isPaused = true
  }

  resume(): void {
    this.isPaused = false
    if (!this.isProcessing) {
      this.processNext()
    }
  }

  stop(): void {
    this.isPaused = true
    this.currentAbortController?.abort()
    this.currentAbortController = null

    // Cancel the currently active item
    const activeItem = this.queue.find((i) =>
      ['fetching', 'downloading', 'converting', 'tagging'].includes(i.status)
    )
    if (activeItem) {
      this.updateItem(activeItem.id, { status: 'cancelled', progress: 0 })
    }
  }

  clearCompleted(): void {
    this.queue = this.queue.filter((i) => !['completed', 'cancelled', 'failed'].includes(i.status))
    this.flushPersist()
  }

  clearAll(): void {
    this.currentAbortController?.abort()
    this.currentAbortController = null
    this.isProcessing = false
    this.isPaused = false
    this.queue = []
    this.lastProgressSent.clear()
    this.flushPersist()
  }

  private isYouTubeRadioMix(url: string): boolean {
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`)
      const list = u.searchParams.get('list') ?? ''
      return list.startsWith('RD') || list.startsWith('RDMM') || list.startsWith('RDCLAK')
    } catch {
      return false
    }
  }

  private isValidYouTubeUrl(url: string): boolean {
    return YOUTUBE_URL_PATTERNS.some((pattern) => pattern.test(url))
  }

  private async processNext(): Promise<void> {
    if (this.isPaused || this.isProcessing) return

    const next = this.queue.find((i) => i.status === 'pending')
    if (!next) return

    this.isProcessing = true
    this.currentAbortController = new AbortController()
    const signal = this.currentAbortController.signal

    try {
      await this.processItem(next, signal)
    } catch {
      // errors are handled inside processItem
    } finally {
      this.isProcessing = false
      this.currentAbortController = null

      if (!this.isPaused) {
        setImmediate(() => this.processNext())
      }
    }
  }

  private async processPodcastItem(item: QueueItem, signal: AbortSignal): Promise<void> {
    const settings = loadSettings()
    const tempDir = tmpdir()
    const meta = item.metadata

    const onProgress: ProgressCallback = (id, progress, status) => {
      this.updateItem(id, { progress, status })
      this.emitProgress(id, progress, status)
    }

    try {
      if (!meta?.audioUrl) throw new Error('Podcast episode missing audio URL')

      // Step 1: Download MP3
      this.updateItem(item.id, { status: 'downloading', progress: 0 })
      this.emitStatusChanged(item.id, 'downloading')

      const tempMp3 = join(tempDir, `nyro-${item.id}.mp3`)
      await httpDownload({
        url: meta.audioUrl,
        outputPath: tempMp3,
        onProgress: (pct) => onProgress(item.id, pct, 'downloading'),
        signal
      })

      if (signal.aborted) {
        this.updateItem(item.id, { status: 'cancelled', progress: 0 })
        try { unlinkSync(tempMp3) } catch { /* ignore */ }
        return
      }

      // Step 2: Write ID3 tags (with thumbnail if available)
      this.updateItem(item.id, { status: 'tagging', progress: 95 })
      this.emitStatusChanged(item.id, 'tagging')

      let podThumbBuf: Buffer | null = null
      if (meta.thumbnailUrl) {
        try { podThumbBuf = await fetchBuffer(meta.thumbnailUrl) } catch { /* non-fatal */ }
      }

      await writeID3Tags(tempMp3, {
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        thumbBuf: podThumbBuf ?? undefined,
      })

      // Step 3: Move to Podcasts/{showName}/
      const baseFolder = item.outputFolder || settings.outputFolder
      const safeShow = sanitizeFilenameComponent(meta.podcastShow || 'Unknown Show')
      const targetFolder = join(baseFolder, 'Podcasts', safeShow)

      if (!existsSync(targetFolder)) {
        mkdirSync(targetFolder, { recursive: true })
      }

      const safeTitle = sanitizeFilenameComponent(meta.title)
      const finalPath = join(targetFolder, `${safeTitle}.mp3`)
      moveFile(tempMp3, finalPath)


      this.updateItem(item.id, {
        status: 'completed',
        progress: 100,
        outputPath: finalPath,
        completedAt: Date.now()
      })
      this.emitStatusChanged(item.id, 'completed')
      this.emitCompleted(item.id, finalPath)
    } catch (err) {
      if (signal.aborted) {
        this.updateItem(item.id, { status: 'cancelled', progress: 0 })
        return
      }
      const errorMsg = err instanceof Error ? err.message : String(err)
      this.updateItem(item.id, { status: 'failed', error: errorMsg, progress: 0 })
      this.emitStatusChanged(item.id, 'failed')
      this.emitError(item.id, errorMsg)
    }
  }

  private async processItem(item: QueueItem, signal: AbortSignal): Promise<void> {
    if (item.source === 'podcast') {
      return this.processPodcastItem(item, signal)
    }

    const settings = loadSettings()
    const tempDir = tmpdir()

    // Skip if the file already exists at the expected output location
    const expectedPath = resolveOutputPath(item, settings)
    if (expectedPath && existsSync(expectedPath)) {
      this.updateItem(item.id, {
        status: 'completed',
        progress: 100,
        outputPath: expectedPath,
        completedAt: Date.now(),
        skipped: true,
      })
      this.emitStatusChanged(item.id, 'completed')
      this.emitCompleted(item.id, expectedPath)
      return
    }

    const onProgress: ProgressCallback = (id, progress, status) => {
      this.updateItem(id, { progress, status })
      this.emitProgress(id, progress, status)
    }

    const isVideo = item.downloadMode === 'video'

    try {
      // Step 1: Download
      this.updateItem(item.id, { status: 'downloading', progress: 0 })
      this.emitStatusChanged(item.id, 'downloading')

      const tempOutputTemplate = join(tempDir, `nyro-${item.id}.%(ext)s`)
      const downloadedPath = await downloadMedia({
        url: item.url,
        outputTemplate: tempOutputTemplate,
        mode: isVideo ? 'video' : 'audio',
        videoQuality: isVideo ? settings.videoQuality : undefined,
        cookiesBrowser: settings.cookiesBrowser || undefined,
        cookiesFile: settings.cookiesFile || undefined,
        onProgress: (pct) => onProgress(item.id, Math.round(pct * (isVideo ? 0.9 : 0.5)), 'downloading'),
        signal
      })

      if (signal.aborted) {
        this.updateItem(item.id, { status: 'cancelled', progress: 0 })
        return
      }

      const meta = item.metadata

      if (isVideo) {
        // Video: skip conversion, just move the mp4
        this.updateItem(item.id, { status: 'tagging', progress: 95 })
        this.emitStatusChanged(item.id, 'tagging')

        const baseFolder = item.outputFolder || settings.outputFolder
        const targetFolder = join(baseFolder, 'Videos')

        if (!existsSync(targetFolder)) {
          mkdirSync(targetFolder, { recursive: true })
        }

        const allItems = this.queue.filter((i) => i.metadata)
        const index = allItems.findIndex((i) => i.id === item.id) + 1
        const total = allItems.length

        const filename = meta
          ? buildFilename({ title: meta.title, artist: meta.artist, settings, index, total })
          : `nyro-${item.id}`

        const finalPath = join(targetFolder, `${filename}.mp4`)
        moveFile(downloadedPath, finalPath)

        this.updateItem(item.id, {
          status: 'completed',
          progress: 100,
          outputPath: finalPath,
          completedAt: Date.now()
        })
        this.emitStatusChanged(item.id, 'completed')
        this.emitCompleted(item.id, finalPath)
        return
      }

      // Audio path: Step 2: Convert to MP3
      this.updateItem(item.id, { status: 'converting', progress: 50 })
      this.emitStatusChanged(item.id, 'converting')

      const tempMp3 = join(tempDir, `nyro-${item.id}.mp3`)
      await convertToMp3({
        inputPath: downloadedPath,
        outputPath: tempMp3,
        bitrate: settings.audioQuality,
        onProgress: (pct) => onProgress(item.id, 50 + Math.round(pct * 0.3), 'converting'),
        signal
      })

      // Cleanup downloaded source
      try {
        unlinkSync(downloadedPath)
      } catch {
        // best effort
      }

      if (signal.aborted) {
        this.updateItem(item.id, { status: 'cancelled', progress: 0 })
        try { unlinkSync(tempMp3) } catch { /* ignore */ }
        return
      }

      // Step 3: Fetch lyrics & write tags
      this.updateItem(item.id, { status: 'tagging', progress: 80 })
      this.emitStatusChanged(item.id, 'tagging')

      let lyricsPlain: string | null = null
      let lyricsSynced: string | null = null

      if (meta && settings.fetchLyrics) {
        const result = await fetchLyrics(meta.artist, meta.title, meta.album, meta.duration)
        lyricsPlain  = result.plain
        lyricsSynced = result.synced
      }

      // Always fetch thumbnail from YouTube — use as track cover and album composite
      let thumbBuf: Buffer | null = null
      if (meta?.thumbnailUrl) {
        try { thumbBuf = await fetchBuffer(meta.thumbnailUrl) } catch { /* non-fatal */ }
      }

      if (meta) {
        await writeID3Tags(tempMp3, {
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          year: meta.year ? String(meta.year) : undefined,
          lyrics: lyricsPlain ?? undefined,
          thumbBuf: thumbBuf ?? undefined,
        })
      }

      // Step 4: Move to output folder
      const baseFolder = item.outputFolder || settings.outputFolder
      let targetFolder = baseFolder

      const effectiveAlbum = item.albumOverride || meta?.album
      if (effectiveAlbum) {
        // Named album → Albums/Album Title (Year)/
        const safeAlbum = sanitizeFilenameComponent(effectiveAlbum)
        const folderName = meta?.year ? `${safeAlbum} (${meta.year})` : safeAlbum
        targetFolder = join(baseFolder, 'Albums', folderName)
      } else if (item.playlistTitle) {
        // Playlist → Playlists/Playlist Name/
        const safeName = sanitizeFilenameComponent(item.playlistTitle)
        targetFolder = join(baseFolder, 'Playlists', safeName)
      } else {
        // Channel/uploader fallback → Artists/Channel Name/
        const uploaderName = meta ? cleanUploader((meta as any).uploader) : ''
        if (uploaderName) {
          const safeName = sanitizeFilenameComponent(uploaderName)
          targetFolder = join(baseFolder, 'Artists', safeName)
        }
      }

      if (!existsSync(targetFolder)) {
        mkdirSync(targetFolder, { recursive: true })
      }

      const allItems = this.queue.filter((i) => i.metadata)
      const index = allItems.findIndex((i) => i.id === item.id) + 1
      const total = allItems.length

      const filename = meta
        ? buildFilename({
            title: meta.title,
            artist: meta.artist,
            settings,
            index,
            total
          })
        : `nyro-${item.id}`

      const finalPath = join(targetFolder, `${filename}.mp3`)
      moveFile(tempMp3, finalPath)

      // Save synced LRC sidecar next to the MP3
      if (lyricsSynced) {
        try {
          writeFileSync(join(targetFolder, `${filename}.lrc`), lyricsSynced, 'utf8')
        } catch { /* non-fatal */ }
      }

      this.updateItem(item.id, {
        status: 'completed',
        progress: 100,
        outputPath: finalPath,
        completedAt: Date.now()
      })
      this.emitStatusChanged(item.id, 'completed')
      this.emitCompleted(item.id, finalPath)
    } catch (err) {
      if (signal.aborted) {
        this.updateItem(item.id, { status: 'cancelled', progress: 0 })
        return
      }
      const errorMsg = err instanceof Error ? err.message : String(err)
      this.updateItem(item.id, { status: 'failed', error: errorMsg, progress: 0 })
      this.emitStatusChanged(item.id, 'failed')
      this.emitError(item.id, errorMsg)
    }
  }

  private updateItem(id: string, changes: Partial<QueueItem>): void {
    // Mutate in-place — avoids O(n) array copy on every progress tick
    const item = this.queue.find(i => i.id === id)
    if (item) Object.assign(item, changes)
    this.schedulePersist()
  }

  private schedulePersist(): void {
    // Debounce disk writes to at most once per second
    if (this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      saveQueue(this.queue)
    }, 1000)
  }

  private flushPersist(): void {
    // Immediate write for terminal state changes (completed, failed, etc.)
    if (this.persistTimer) { clearTimeout(this.persistTimer); this.persistTimer = null }
    saveQueue(this.queue)
  }

  private emitProgress(id: string, progress: number, status: QueueStatus): void {
    // Throttle to at most 4 IPC messages per second per item (250ms)
    const now = Date.now()
    const last = this.lastProgressSent.get(id) ?? 0
    if (now - last < 250) return
    this.lastProgressSent.set(id, now)
    this.window?.webContents.send(IPC_CHANNELS.QUEUE_PROGRESS, { id, progress, status })
  }

  private emitStatusChanged(id: string, status: QueueStatus): void {
    // Terminal states get an immediate disk flush so queue survives restarts
    if (['completed', 'failed', 'cancelled'].includes(status)) {
      this.lastProgressSent.delete(id)
      this.flushPersist()
    }
    this.window?.webContents.send(IPC_CHANNELS.QUEUE_STATUS_CHANGED, { id, status })
  }

  private emitCompleted(id: string, outputPath: string): void {
    this.window?.webContents.send(IPC_CHANNELS.QUEUE_COMPLETED, { id, outputPath })
  }

  private emitError(id: string, error: string): void {
    this.window?.webContents.send(IPC_CHANNELS.QUEUE_ERROR, { id, error })
  }
}

export const queueManager = new QueueManager()
