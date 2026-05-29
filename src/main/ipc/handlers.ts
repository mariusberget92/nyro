import { ipcMain, dialog, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { queueManager } from '../queue/manager'
import { loadSettings, updateSettings } from '../storage/store'

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
}
