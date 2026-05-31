import { app, BrowserWindow, shell, protocol, globalShortcut, Tray, Menu, nativeImage } from 'electron'
import { join, extname } from 'path'
import { createReadStream, statSync } from 'fs'
import { registerIpcHandlers } from './ipc/handlers'
import { checkAndUpdate } from './services/updater'
import { IPC_CHANNELS } from '@shared/constants'

const MIME: Record<string, string> = {
  mp3: 'audio/mpeg', mp4: 'video/mp4', m4a: 'audio/mp4',
  ogg: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac',
  mkv: 'video/x-matroska', webm: 'video/webm',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
}

function serveFile(filePath: string, rangeHeader: string | null): Response {
  const stat = statSync(filePath)
  const total = stat.size
  const mime = MIME[extname(filePath).slice(1).toLowerCase()] ?? 'application/octet-stream'

  const toWebStream = (start: number, end: number) => {
    const ns = createReadStream(filePath, { start, end })
    return new ReadableStream({
      start(ctrl) {
        ns.on('data', chunk => ctrl.enqueue(chunk))
        ns.on('end', () => ctrl.close())
        ns.on('error', err => ctrl.error(err))
      },
      cancel() { ns.destroy() }
    })
  }

  if (rangeHeader) {
    const m = rangeHeader.match(/bytes=(\d+)-(\d*)/)
    if (m) {
      const start = parseInt(m[1])
      const end = m[2] ? parseInt(m[2]) : total - 1
      return new Response(toWebStream(start, end), {
        status: 206,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
        }
      })
    }
  }

  return new Response(toWebStream(0, total - 1), {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Length': String(total),
      'Accept-Ranges': 'bytes',
    }
  })
}

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
let tray: Tray | null = null

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Show Nyro',
      click: () => { mainWindow?.show(); mainWindow?.focus() },
    },
    { type: 'separator' },
    { label: '⏯  Play / Pause', click: () => mainWindow?.webContents.send('media:playpause') },
    { label: '⏭  Next',         click: () => mainWindow?.webContents.send('media:next') },
    { label: '⏮  Previous',     click: () => mainWindow?.webContents.send('media:prev') },
    { type: 'separator' },
    { label: 'Quit Nyro', role: 'quit' },
  ])
}

function createTray() {
  let icon: Electron.NativeImage
  try {
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'resources', 'icon.png')
      : join(__dirname, '../../resources/icon.png')
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  } catch {
    icon = nativeImage.createEmpty()
  }
  tray = new Tray(icon)
  tray.setToolTip('Nyro')
  tray.setContextMenu(buildTrayMenu())
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
  // On Windows, left-click shows window
  tray.on('click', () => { if (process.platform === 'win32') { mainWindow?.show(); mainWindow?.focus() } })
}

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

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
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
  // Serve local files — handles Range requests so HTML5 audio seeking works
  protocol.handle('nyro-file', (request) => {
    try {
      const filePath = new URL(request.url).searchParams.get('p')
      if (!filePath) return new Response('Not found', { status: 404 })
      return serveFile(filePath, request.headers.get('range'))
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  createWindow()
  createTray()

  // System-wide media key bindings
  const send = (ch: string) => mainWindow?.webContents.send(ch)
  globalShortcut.register('MediaPlayPause',  () => send('media:playpause'))
  globalShortcut.register('MediaNextTrack',  () => send('media:next'))
  globalShortcut.register('MediaPreviousTrack', () => send('media:prev'))
  globalShortcut.register('MediaStop',       () => send('media:stop'))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  (app as any).isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  tray?.destroy()
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
