export const APP_NAME = 'Nyro'
export const APP_VERSION = '1.0.0'

export const IPC_CHANNELS = {
  // Renderer → Main
  QUEUE_ADD: 'queue:add',
  QUEUE_REMOVE: 'queue:remove',
  QUEUE_START: 'queue:start',
  QUEUE_PAUSE: 'queue:pause',
  QUEUE_RESUME: 'queue:resume',
  QUEUE_STOP: 'queue:stop',
  QUEUE_CLEAR_COMPLETED: 'queue:clear-completed',
  QUEUE_GET_ALL: 'queue:get-all',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  DIALOG_SELECT_FOLDER: 'dialog:select-folder',
  // Main → Renderer
  QUEUE_PROGRESS: 'queue:progress',
  QUEUE_STATUS_CHANGED: 'queue:status-changed',
  QUEUE_COMPLETED: 'queue:completed',
  QUEUE_ERROR: 'queue:error'
} as const

export const YOUTUBE_URL_PATTERNS = [
  /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
  /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
  /^(https?:\/\/)?(www\.)?youtube\.com\/playlist\?list=[\w-]+/,
  /^(https?:\/\/)?(music\.)?youtube\.com\/watch\?v=[\w-]+/
]

export const WINDOWS_INVALID_CHARS = /[\\/:*?"<>|]/g

export const YTDLP_BINARY = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
export const FFMPEG_BINARY = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

export const LRCLIB_API_BASE = 'https://lrclib.net/api'
