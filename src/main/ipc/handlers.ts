import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '@shared/constants'
import { queueManager } from '../queue/manager'
import { loadSettings, updateSettings } from '../storage/store'
import { searchPodcasts, getPodcastSeries, getEpisode } from '../services/taddy'
import { scanLibrary } from '../services/library'
import { readFileSync, writeFileSync, existsSync } from 'fs'

let libraryCache: ReturnType<typeof scanLibrary> | null = null

function libraryCachePath() {
  return join(app.getPath('userData'), 'library-cache.json')
}

function saveLibraryCache(result: ReturnType<typeof scanLibrary>) {
  try { writeFileSync(libraryCachePath(), JSON.stringify(result), 'utf8') } catch {}
}

function loadLibraryCache(): ReturnType<typeof scanLibrary> | null {
  try {
    const p = libraryCachePath()
    if (!existsSync(p)) return null
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch { return null }
}

export function registerIpcHandlers(win: BrowserWindow): void {
  queueManager.setWindow(win)

  // queue:add — validate URL, fetch metadata, create queue items
  ipcMain.handle(IPC_CHANNELS.QUEUE_ADD, async (_event, url: string) => {
    return await queueManager.addUrl(url)
  })

  // queue:remove — remove an item from the queue
  ipcMain.handle(IPC_CHANNELS.QUEUE_REMOVE, (_event, id: string) => {
    queueManager.removeItem(id)
  })

  // queue:start — begin processing the queue
  ipcMain.handle(IPC_CHANNELS.QUEUE_START, async () => {
    await queueManager.start()
  })

  // queue:pause — pause queue after current item
  ipcMain.handle(IPC_CHANNELS.QUEUE_PAUSE, () => {
    queueManager.pause()
  })

  // queue:resume — resume processing
  ipcMain.handle(IPC_CHANNELS.QUEUE_RESUME, () => {
    queueManager.resume()
  })

  // queue:stop — cancel current download, mark cancelled
  ipcMain.handle(IPC_CHANNELS.QUEUE_STOP, () => {
    queueManager.stop()
  })

  // queue:clear-completed — remove completed/cancelled/failed items
  ipcMain.handle(IPC_CHANNELS.QUEUE_CLEAR_COMPLETED, () => {
    queueManager.clearCompleted()
  })

  // queue:clear-all — remove every item (stops active download first)
  ipcMain.handle(IPC_CHANNELS.QUEUE_CLEAR_ALL, () => {
    queueManager.clearAll()
  })

  // queue:get-all — return current queue state
  ipcMain.handle(IPC_CHANNELS.QUEUE_GET_ALL, () => {
    return queueManager.getQueue()
  })

  // settings:get — return current settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return loadSettings()
  })

  // settings:set — merge partial settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, partial) => {
    updateSettings(partial)
  })

  // dialog:select-folder — open native folder picker
  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Output Folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // dialog:select-file — open native file picker (for cookies.txt)
  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FILE, async (_event, opts?: { title?: string; filters?: Electron.FileFilter[] }) => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      title: opts?.title ?? 'Select File',
      filters: opts?.filters ?? [{ name: 'All Files', extensions: ['*'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // podcast:search-shows
  ipcMain.handle(IPC_CHANNELS.PODCAST_SEARCH_SHOWS, async (_event, query: string) => {
    const settings = loadSettings()
    if (!settings.taddyUserId || !settings.taddyApiKey) throw new Error('Taddy credentials not set. Add them in Settings.')
    return searchPodcasts(query, settings.taddyUserId, settings.taddyApiKey)
  })

  // podcast:get-show — uuid + optional page number for pagination
  ipcMain.handle(IPC_CHANNELS.PODCAST_GET_SHOW, async (_event, uuid: string, page?: number) => {
    const settings = loadSettings()
    if (!settings.taddyUserId || !settings.taddyApiKey) throw new Error('Taddy credentials not set. Add them in Settings.')
    return getPodcastSeries(uuid, settings.taddyUserId, settings.taddyApiKey, page ?? 1)
  })

  // podcast:add-episode
  ipcMain.handle(IPC_CHANNELS.PODCAST_ADD_EPISODE, async (_event, episodeId: string) => {
    return queueManager.addPodcastEpisode(episodeId)
  })

  // library:scan — walk output folder, read ID3 tags
  ipcMain.handle(IPC_CHANNELS.LIBRARY_SCAN, () => {
    const settings = loadSettings()
    if (!settings.outputFolder) throw new Error('No output folder set.')
    const cacheDir = join(app.getPath('userData'), 'covers')
    libraryCache = scanLibrary(settings.outputFolder, cacheDir)
    saveLibraryCache(libraryCache)
    return libraryCache
  })

  // library:get — return in-memory cache, fall back to disk, or null if never scanned
  ipcMain.handle(IPC_CHANNELS.LIBRARY_GET, () => {
    if (!libraryCache) libraryCache = loadLibraryCache()
    return libraryCache
  })

  // library:get-lrc — read a .lrc sidecar file and return its content
  ipcMain.handle(IPC_CHANNELS.LIBRARY_GET_LRC, (_event, lrcPath: string) => {
    try { return readFileSync(lrcPath, 'utf8') } catch { return null }
  })
}
