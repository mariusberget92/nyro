export interface AppSettings {
  outputFolder: string
  numericPrefix: boolean
  concurrentDownloads: number
  audioQuality: '320' | '256' | '192' | '128'
  filenameFormat: 'artist-title' | 'title-artist' | 'title'
  fetchLyrics: boolean
  embedThumbnail: boolean
  listenNotesApiKey: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  outputFolder: '',
  numericPrefix: false,
  concurrentDownloads: 1,
  audioQuality: '320',
  filenameFormat: 'artist-title',
  fetchLyrics: true,
  embedThumbnail: false,
  listenNotesApiKey: ''
}
