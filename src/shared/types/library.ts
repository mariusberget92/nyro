export interface LibraryTrack {
  id: string
  path: string
  title: string
  artist: string
  album: string
  year?: number
  duration?: number
  trackNumber?: number
  genre?: string
  coverPath?: string   // cached cover art on disk
  source: 'music' | 'podcast' | 'video'
}

export interface LibraryAlbum {
  name: string
  artist: string
  year?: number
  coverPath?: string
  tracks: LibraryTrack[]
}

export interface LibraryArtist {
  name: string
  coverPath?: string
  albums: LibraryAlbum[]
  tracks: LibraryTrack[]
}

export interface LibraryScanResult {
  tracks: LibraryTrack[]
  scannedAt: number
}
