export type AudioQuality = '64' | '96' | '128' | '160' | '192' | '256' | '320' | '384' | '448'

export interface AppSettings {
  outputFolder: string
  numericPrefix: boolean
  prefixTemplate: string
  concurrentDownloads: number
  audioQuality: AudioQuality
  filenameFormat: 'artist-title' | 'title-artist' | 'title'
  fetchLyrics: boolean
  embedThumbnail: boolean
  listenNotesApiKey: string
  taddyUserId: string
  taddyApiKey: string
  downloadMode: 'audio' | 'video'
  videoQuality: '4K' | '1080p' | '720p' | '480p'
  cookiesBrowser: '' | 'chrome' | 'firefox' | 'edge' | 'brave' | 'opera' | 'vivaldi' | 'safari'
  cookiesFile: string   // path to a cookies.txt (Netscape format); takes priority over cookiesBrowser
}

export const DEFAULT_SETTINGS: AppSettings = {
  outputFolder: '',
  numericPrefix: false,
  prefixTemplate: '{000} - ',
  concurrentDownloads: 1,
  audioQuality: '320',
  filenameFormat: 'artist-title',
  fetchLyrics: true,
  embedThumbnail: false,
  listenNotesApiKey: '',
  taddyUserId: '',
  taddyApiKey: '',
  downloadMode: 'audio',
  videoQuality: '1080p',
  cookiesBrowser: '',
  cookiesFile: '',
}
