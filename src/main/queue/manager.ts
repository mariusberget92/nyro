import { BrowserWindow } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync, renameSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { v4 as uuidv4 } from 'uuid'
import type { QueueItem, QueueStatus } from '@shared/types/queue'
import { IPC_CHANNELS, YOUTUBE_URL_PATTERNS } from '@shared/constants'
import { fetchMetadata, downloadAudio } from '../services/ytdlp'
import { convertToMp3 } from '../services/ffmpeg'
import { writeID3Tags } from '../services/metadata'
import { fetchLyrics } from '../services/lyrics'
import { buildFilename, sanitizeFilenameComponent } from '../services/filename'
import { loadQueue, saveQueue, loadSettings } from '../storage/store'
import { httpDownload } from '../services/httpDownload'
import { getEpisode } from '../services/listennotes'

type ProgressCallback = (id: string, progress: number, status: QueueStatus) => void

class QueueManager {
  private queue: QueueItem[] = []
  private isPaused = false
  private isProcessing = false
  private currentAbortController: AbortController | null = null
  private window: BrowserWindow | null = null

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

  async addPodcastEpisode(episodeId: string): Promise<QueueItem> {
    const settings = loadSettings()
    if (!settings.listenNotesApiKey) throw new Error('ListenNotes API key not set')
    const ep = await getEpisode(episodeId, settings.listenNotesApiKey)
    const item: QueueItem = {
      id: uuidv4(),
      url: ep.audio,
      source: 'podcast',
      status: 'pending',
      progress: 0,
      addedAt: Date.now(),
      podcastShowTitle: ep.podcast.title,
      metadata: {
        title: ep.title,
        artist: ep.podcast.publisher,
        album: ep.podcast.title,
        duration: ep.audio_length_sec,
        thumbnailUrl: ep.image,
        videoId: ep.id,
        podcastShow: ep.podcast.title,
        podcastShowId: ep.podcast.id,
        audioUrl: ep.audio
      }
    }
    this.queue.push(item)
    this.persist()
    this.emitStatusChanged(item.id, 'pending')
    return item
  }

  async addUrl(url: string): Promise<QueueItem[]> {
    if (!this.isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL')
    }

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
    this.persist()
    this.emitStatusChanged(placeholderId, 'fetching')

    let metadataList
    try {
      metadataList = await fetchMetadata(url)
    } catch (err) {
      this.updateItem(placeholderId, { status: 'failed', error: String(err) })
      throw err
    }

    // Remove placeholder
    this.queue = this.queue.filter((i) => i.id !== placeholderId)

    const newItems: QueueItem[] = metadataList.map((meta) => {
      const year = meta.release_year
        ?? (meta.release_date ? parseInt(meta.release_date.substring(0, 4)) : undefined)
        ?? (meta.upload_date ? parseInt(meta.upload_date.substring(0, 4)) : undefined)

      return {
        id: uuidv4(),
        url: meta.webpage_url || url,
        status: 'pending' as QueueStatus,
        progress: 0,
        addedAt: Date.now(),
        metadata: {
          title: meta.title || 'Unknown Title',
          artist: meta.uploader || 'Unknown Artist',
          album: meta.album || '',
          year: isNaN(year as number) ? undefined : year,
          duration: meta.duration || 0,
          thumbnailUrl: meta.thumbnail,
          videoId: meta.id
        }
      }
    })

    this.queue.push(...newItems)
    this.persist()

    for (const item of newItems) {
      this.emitStatusChanged(item.id, 'pending')
    }

    return newItems
  }

  removeItem(id: string): void {
    const item = this.queue.find((i) => i.id === id)
    if (item && ['downloading', 'converting', 'tagging', 'fetching'].includes(item.status)) {
      this.currentAbortController?.abort()
    }
    this.queue = this.queue.filter((i) => i.id !== id)
    this.persist()
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
    this.persist()
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

      // Step 2: Write ID3 tags
      this.updateItem(item.id, { status: 'tagging', progress: 95 })
      this.emitStatusChanged(item.id, 'tagging')

      await writeID3Tags(tempMp3, {
        title: meta.title,
        artist: meta.artist,
        album: meta.album
      })

      // Step 3: Move to Podcasts/{showName}/
      const baseFolder = settings.outputFolder
      const safeShow = sanitizeFilenameComponent(meta.podcastShow || 'Unknown Show')
      const targetFolder = join(baseFolder, 'Podcasts', safeShow)

      if (!existsSync(targetFolder)) {
        mkdirSync(targetFolder, { recursive: true })
      }

      const safeTitle = sanitizeFilenameComponent(meta.title)
      const finalPath = join(targetFolder, `${safeTitle}.mp3`)
      renameSync(tempMp3, finalPath)

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

    const onProgress: ProgressCallback = (id, progress, status) => {
      this.updateItem(id, { progress, status })
      this.emitProgress(id, progress, status)
    }

    try {
      // Step 1: Download audio
      this.updateItem(item.id, { status: 'downloading', progress: 0 })
      this.emitStatusChanged(item.id, 'downloading')

      const tempOutputTemplate = join(tempDir, `nyro-${item.id}.%(ext)s`)
      const downloadedPath = await downloadAudio({
        url: item.url,
        outputTemplate: tempOutputTemplate,
        onProgress: (pct) => onProgress(item.id, Math.round(pct * 0.5), 'downloading'),
        signal
      })

      if (signal.aborted) {
        this.updateItem(item.id, { status: 'cancelled', progress: 0 })
        return
      }

      // Step 2: Convert to MP3
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

      const meta = item.metadata
      let lyrics: string | null = null

      if (meta && settings.fetchLyrics) {
        lyrics = await fetchLyrics(meta.artist, meta.title, meta.album, meta.duration)
      }

      if (meta) {
        await writeID3Tags(tempMp3, {
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          lyrics: lyrics ?? undefined
        })
      }

      // Step 4: Move to output folder
      const baseFolder = settings.outputFolder

      // If the track has an album, save to Albums/Album Title (Year)/
      let targetFolder = baseFolder
      if (meta?.album) {
        const safeAlbum = sanitizeFilenameComponent(meta.album)
        const folderName = meta.year ? `${safeAlbum} (${meta.year})` : safeAlbum
        targetFolder = join(baseFolder, 'Albums', folderName)
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
      renameSync(tempMp3, finalPath)

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
    this.queue = this.queue.map((item) => (item.id === id ? { ...item, ...changes } : item))
    this.persist()
  }

  private persist(): void {
    saveQueue(this.queue)
  }

  private emitProgress(id: string, progress: number, status: QueueStatus): void {
    this.window?.webContents.send(IPC_CHANNELS.QUEUE_PROGRESS, { id, progress, status })
  }

  private emitStatusChanged(id: string, status: QueueStatus): void {
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
