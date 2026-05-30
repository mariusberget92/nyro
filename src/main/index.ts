import { app, BrowserWindow, shell, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { registerIpcHandlers } from './ipc/handlers'
import { checkAndUpdate } from './services/updater'
import { IPC_CHANNELS } from '@shared/constants'

// Must be called before app is ready
protocol.registerSchemesAsPrivileged([{
  scheme: 'nyro-file',
  privileges: { secure: true, standard: true, stream: true, supportFetchAPI: true }
}])

// Ensure single instance
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 550,
    frame: true,
    show: false,
    backgroundColor: '#0f0f11',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()

    // Run binary check after a short delay so the UI is fully rendered first
    setTimeout(() => {
      checkAndUpdate((message) => {
        mainWindow?.webContents.send(IPC_CHANNELS.UPDATER_STATUS, { message })
      }).then((result) => {
        mainWindow?.webContents.send(IPC_CHANNELS.UPDATER_STATUS, {
          message: result.ytdlpUpdated
            ? `yt-dlp updated to ${result.ytdlp.current}`
            : result.ytdlp.found
              ? `yt-dlp ${result.ytdlp.current} · FFmpeg ${result.ffmpeg.current ?? 'not found'}`
              : 'yt-dlp not found — downloads will fail',
          done: true,
          ytdlpUpdated: result.ytdlpUpdated,
          ffmpegMissing: !result.ffmpeg.found,
        })
      }).catch(() => {
        mainWindow?.webContents.send(IPC_CHANNELS.UPDATER_STATUS, {
          message: 'Binary check failed',
          done: true,
        })
      })
    }, 1500)
  })

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  registerIpcHandlers(mainWindow)
}

app.whenReady().then(() => {
  // Serve local files for the media player via nyro-file:// protocol
  // URL format: nyro-file://local?p=<encodeURIComponent(absolutePath)>
  protocol.handle('nyro-file', (request) => {
    try {
      const url = new URL(request.url)
      const filePath = url.searchParams.get('p')
      if (!filePath) return new Response('Not found', { status: 404 })
      return net.fetch(pathToFileURL(filePath).toString())
    } catch {
      return new Response('Bad request', { status: 400 })
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
