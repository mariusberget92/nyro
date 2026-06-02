import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '@shared/constants'
import { queueManager } from '../queue/manager'
import { loadSettings, updateSettings } from '../storage/store'
import { searchPodcasts, getPodcastSeries } from '../services/taddy'
import { scanLibrary } from '../services/library'
import type { LibraryTrack } from '@shared/types/library'
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync, mkdirSync } from 'fs'
import { fetchLyrics } from '../services/lyrics'
import { createHash } from 'crypto'
import NodeID3 from 'node-id3'
import { getDb, getAllTracks, updateTracksInFolder, setThumbnail, deleteTrackByPath, hasTracks } from '../database/db'

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

  // library:scan — walk output folder, read ID3 tags, store in SQLite
  ipcMain.handle(IPC_CHANNELS.LIBRARY_SCAN, async () => {
    const settings = loadSettings()
    if (!settings.outputFolder) throw new Error('No output folder set.')
    return await scanLibrary(settings.outputFolder, getDb())
  })

  // library:get — return tracks from SQLite; null if never scanned
  ipcMain.handle(IPC_CHANNELS.LIBRARY_GET, () => {
    const db = getDb()
    if (!hasTracks(db)) return null
    const rows = getAllTracks(db)
    const tracks: LibraryTrack[] = rows.map(row => ({
      id: row.id,
      path: row.path,
      title: row.title,
      artist: row.artist,
      album: row.album,
      year: row.year ?? undefined,
      trackNumber: row.track_number ?? undefined,
      genre: row.genre ?? undefined,
      lrcPath: row.lrc_path ?? undefined,
      source: row.source as LibraryTrack['source'],
      coverPath: row.has_thumbnail ? `nyro-thumb://${row.id}` : undefined,
    }))
    const scannedAt = rows.reduce((m, r) => Math.max(m, r.scanned_at), 0)
    return { tracks, scannedAt }
  })

  // library:get-lrc — read a .lrc sidecar file and return its content
  ipcMain.handle(IPC_CHANNELS.LIBRARY_GET_LRC, (_event, lrcPath: string) => {
    try { return readFileSync(lrcPath, 'utf8') } catch { return null }
  })

  // library:fetch-lrc — fetch lyrics on-demand for a track that has no sidecar yet
  ipcMain.handle(IPC_CHANNELS.LIBRARY_FETCH_LRC, async (_event, args: { trackPath: string; artist: string; title: string; album?: string; duration?: number }) => {
    const lrcPath = args.trackPath.replace(/\.[^.]+$/, '.lrc')
    if (existsSync(lrcPath)) {
      try { return { lrcPath, content: readFileSync(lrcPath, 'utf8') } } catch { /* fall through */ }
    }
    const result = await fetchLyrics(args.artist, args.title, args.album, args.duration)
    if (result.synced) {
      try { writeFileSync(lrcPath, result.synced, 'utf8') } catch { /* non-fatal */ }
      return { lrcPath, content: result.synced }
    }
    if (result.plain) return { lrcPath: null, content: result.plain }
    return null
  })

  // library:rename-folder — rename an album or podcast folder on disk, update SQLite
  ipcMain.handle(IPC_CHANNELS.LIBRARY_RENAME_FOLDER, (_event, oldPath: string, newName: string) => {
    const parent = join(oldPath, '..')
    const newPath = join(parent, newName)
    if (!existsSync(oldPath)) throw new Error('Folder not found: ' + oldPath)
    if (oldPath === newPath || oldPath.toLowerCase() === newPath.toLowerCase()) return newPath
    if (existsSync(newPath)) throw new Error('A folder with that name already exists.')
    renameSync(oldPath, newPath)
    updateTracksInFolder(getDb(), oldPath, newPath, newName)
    return newPath
  })

  // library:set-cover — store cover in SQLite, embed in ID3 tags
  ipcMain.handle(IPC_CHANNELS.LIBRARY_SET_COVER, async (_event, trackPath: string, imagePath: string) => {
    const id = createHash('md5').update(trackPath).digest('hex')
    const imgBuffer = readFileSync(imagePath)
    const mime = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    setThumbnail(getDb(), id, imgBuffer, mime)
    const ext = trackPath.split('.').pop()?.toLowerCase() ?? ''
    if (['mp3', 'm4a', 'flac', 'ogg', 'wav', 'aac'].includes(ext)) {
      try {
        NodeID3.update({ image: { mime, type: { id: 3, name: 'front cover' }, description: 'Cover', imageBuffer: imgBuffer } }, trackPath)
      } catch {}
    }
    return `nyro-thumb://${id}`
  })

  // library:delete-tracks — delete files from disk and remove from SQLite
  ipcMain.handle(IPC_CHANNELS.LIBRARY_DELETE_TRACKS, (_event, paths: string[]) => {
    const db = getDb()
    for (const p of paths) {
      try { unlinkSync(p) } catch {}
      deleteTrackByPath(db, p)
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
