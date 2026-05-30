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
  QUEUE_CLEAR_ALL: 'queue:clear-all',
  QUEUE_GET_ALL: 'queue:get-all',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  DIALOG_SELECT_FOLDER: 'dialog:select-folder',
  DIALOG_SELECT_FILE:   'dialog:select-file',
  // Podcast
  PODCAST_SEARCH_SHOWS: 'podcast:search-shows',
  PODCAST_SEARCH_EPISODES: 'podcast:search-episodes',
  PODCAST_GET_SHOW: 'podcast:get-show',
  PODCAST_ADD_EPISODE: 'podcast:add-episode',
  // Library
  UPDATER_STATUS:  'updater:status',   // Main → Renderer push
  LIBRARY_SCAN:    'library:scan',
  LIBRARY_GET:     'library:get',
  LIBRARY_GET_LRC: 'library:get-lrc',
  // Main → Renderer
  QUEUE_PROGRESS: 'queue:progress',
  QUEUE_STATUS_CHANGED: 'queue:status-changed',
  QUEUE_COMPLETED: 'queue:completed',
  QUEUE_ERROR: 'queue:error'
} as const

export const YOUTUBE_URL_PATTERNS = [
  // YouTube
  /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
  /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
  /^(https?:\/\/)?(www\.)?youtube\.com\/playlist\?list=[\w-]+/,
  /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
  // YouTube Music
  /^(https?:\/\/)?music\.youtube\.com\/watch\?v=[\w-]+/,
  /^(https?:\/\/)?music\.youtube\.com\/playlist\?list=[\w-]+/,
  /^(https?:\/\/)?music\.youtube\.com\/browse\/.+/,
  // SoundCloud
  /^(https?:\/\/)?(www\.)?soundcloud\.com\/.+/,
  // Bandcamp
  /^(https?:\/\/)?.+\.bandcamp\.com\/.*/,
  // Vimeo
  /^(https?:\/\/)?(www\.)?vimeo\.com\/.+/,
]

export const AUDIO_QUALITIES = ['64', '96', '128', '160', '192', '256', '320', '384', '448'] as const

export const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'mov']

export const WINDOWS_INVALID_CHARS = /[\\/:*?"<>|]/g

export const YTDLP_BINARY = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
export const FFMPEG_BINARY = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

export const LRCLIB_API_BASE = 'https://lrclib.net/api'
