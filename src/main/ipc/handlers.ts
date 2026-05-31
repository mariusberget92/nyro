import { ipcMain, dialog, BrowserWindow, app, shell } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '@shared/constants'
import { queueManager } from '../queue/manager'
import { loadSettings, updateSettings } from '../storage/store'
import { searchPodcasts, getPodcastSeries, getEpisode } from '../services/taddy'
import { scanLibrary } from '../services/library'
import type { LibraryScanResult } from '@shared/types/library'
import { readFileSync, writeFileSync, existsSync, renameSync, readdirSync, unlinkSync, mkdirSync, copyFileSync } from 'fs'
import { createHash } from 'crypto'
import NodeID3 from 'node-id3'

let libraryCache: LibraryScanResult | null = null

function libraryCachePath() {
  return join(app.getPath('userData'), 'library-cache.json')
}

function saveLibraryCache(result: LibraryScanResult) {
  try { writeFileSync(libraryCachePath(), JSON.stringify(result), 'utf8') } catch {}
}

function loadLibraryCache(): LibraryScanResult | null {
  try {
    const p = libraryCachePath()
    if (!existsSync(p)) return null
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch { return null }
}

export function registerIpcHandlers(win: BrowserWindow): void {
  queueManager.setWindow(win)

  // queue:add — validate URL, fetch metadata, create queue items
  ipcMain.handle(IPC_CHANNELS.QUEUE_ADD, async (_event, url: string, outputFolder?: string, albumOverride?: string) => {
    return await queueManager.addUrl(url, outputFolder, albumOverride)
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
  ipcMain.handle(IPC_CHANNELS.PODCAST_ADD_EPISODE, async (_event, episodeId: string, outputFolder?: string, showName?: string) => {
    return queueManager.addPodcastEpisode(episodeId, outputFolder, showName)
  })

  // library:scan — walk output folder, read ID3 tags (async to keep main thread responsive)
  ipcMain.handle(IPC_CHANNELS.LIBRARY_SCAN, async () => {
    const settings = loadSettings()
    if (!settings.outputFolder) throw new Error('No output folder set.')
    const cacheDir = join(app.getPath('userData'), 'covers')
    libraryCache = await scanLibrary(settings.outputFolder, cacheDir)
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

  // library:rename-folder — rename an album or podcast folder on disk
  ipcMain.handle(IPC_CHANNELS.LIBRARY_RENAME_FOLDER, (_event, oldPath: string, newName: string) => {
    const parent = join(oldPath, '..')
    const newPath = join(parent, newName)
    if (!existsSync(oldPath)) throw new Error('Folder not found: ' + oldPath)
    // No-op: renaming to the same name (exact match or case-only change on case-insensitive FS)
    if (oldPath === newPath || oldPath.toLowerCase() === newPath.toLowerCase()) return newPath
    if (existsSync(newPath)) throw new Error('A folder with that name already exists.')
    renameSync(oldPath, newPath)
    // Patch in-memory cache so the library reflects the rename without a full rescan
    if (libraryCache) {
      for (const track of libraryCache.tracks) {
        if (track.path.startsWith(oldPath + '/') || track.path.startsWith(oldPath + '\\')) {
          track.path = newPath + track.path.slice(oldPath.length)
          if (track.coverPath) track.coverPath = newPath + track.coverPath.slice(oldPath.length)
          track.album = newName
        }
      }
      saveLibraryCache(libraryCache)
    }
    return newPath
  })

  // library:set-cover — copy image to covers cache, embed in ID3, patch cache
  ipcMain.handle(IPC_CHANNELS.LIBRARY_SET_COVER, async (_event, trackPath: string, imagePath: string) => {
    const cacheDir = join(app.getPath('userData'), 'covers')
    mkdirSync(cacheDir, { recursive: true })
    if (!libraryCache) libraryCache = loadLibraryCache()
    const id = createHash('md5').update(trackPath).digest('hex')
    const srcExt = imagePath.split('.').pop()?.toLowerCase() ?? 'jpg'
    const destExt = srcExt === 'png' ? 'png' : 'jpg'
    const destPath = join(cacheDir, `${id}.${destExt}`)
    copyFileSync(imagePath, destPath)
    const altExt = destExt === 'png' ? 'jpg' : 'png'
    const altPath = join(cacheDir, `${id}.${altExt}`)
    if (existsSync(altPath)) try { unlinkSync(altPath) } catch {}
    const ext = trackPath.split('.').pop()?.toLowerCase() ?? ''
    if (['mp3', 'm4a', 'flac', 'ogg', 'wav', 'aac'].includes(ext)) {
      try {
        const imgBuffer = readFileSync(imagePath)
        const mime = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
        NodeID3.update({ image: { mime, type: { id: 3, name: 'front cover' }, description: 'Cover', imageBuffer: imgBuffer } }, trackPath)
      } catch {}
    }
    if (libraryCache) {
      const track = libraryCache.tracks.find(t => t.path === trackPath)
      if (track) track.coverPath = destPath
      saveLibraryCache(libraryCache)
    }
    return destPath
  })

  // library:delete-tracks — delete files from disk and remove from cache
  ipcMain.handle(IPC_CHANNELS.LIBRARY_DELETE_TRACKS, (_event, paths: string[]) => {
    for (const p of paths) try { unlinkSync(p) } catch {}
    if (libraryCache) {
      libraryCache.tracks = libraryCache.tracks.filter(t => !paths.includes(t.path))
      saveLibraryCache(libraryCache)
    }
  })

  // shell:show-in-folder — reveal a file in Explorer/Finder/Nautilus
  ipcMain.handle(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER, (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  // library:create-folder — create a new empty subdirectory inside the output folder
  ipcMain.handle(IPC_CHANNELS.LIBRARY_CREATE_FOLDER, (_event, folderName: string, subfolder?: string) => {
    const settings = loadSettings()
    if (!settings.outputFolder) throw new Error('No output folder set.')
    const base = subfolder ? join(settings.outputFolder, subfolder) : settings.outputFolder
    const target = join(base, folderName)
    if (existsSync(target)) throw new Error('A folder with that name already exists.')
    mkdirSync(target, { recursive: true })
    return target
  })

  // library:link-track — create a symlink (or copy on Windows) of a track into a target folder
  ipcMain.handle(IPC_CHANNELS.LIBRARY_LINK_TRACK, async (_event, trackPath: string, targetFolder: string) => {
    const { basename } = await import('path')
    const { symlinkSync, copyFileSync: cp } = await import('fs')
    const destPath = join(targetFolder, basename(trackPath))
    if (existsSync(destPath)) throw new Error('A file with that name already exists in the target folder.')
    if (process.platform === 'win32') {
      cp(trackPath, destPath)
    } else {
      symlinkSync(trackPath, destPath)
    }
    return destPath
  })
}
