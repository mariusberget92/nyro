import { defineStore } from 'pinia'
import type { LibraryTrack, LibraryAlbum, LibraryArtist } from '@shared/types/library'

export const useLibraryStore = defineStore('library', {
  state: () => ({
    tracks: [] as LibraryTrack[],
    scannedAt: null as number | null,
    scanning: false,
  }),

  getters: {
    albums: (state): LibraryAlbum[] => {
      const map = new Map<string, LibraryAlbum>()
      for (const t of state.tracks) {
        if (t.source !== 'music') continue
        const key = t.album
        if (!map.has(key)) {
          map.set(key, { name: t.album, artist: t.artist, year: t.year, coverPath: t.coverPath, tracks: [] })
        }
        const entry = map.get(key)!
        if (entry.artist !== t.artist) entry.artist = 'Various Artists'
        if (!entry.coverPath && t.coverPath) entry.coverPath = t.coverPath
        entry.tracks.push(t)
      }
      for (const album of map.values()) {
        album.tracks.sort((a, b) => (a.trackNumber ?? 999) - (b.trackNumber ?? 999))
      }
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
    },

    artists: (state): LibraryArtist[] => {
      const map = new Map<string, LibraryArtist>()
      for (const t of state.tracks) {
        if (t.source !== 'music') continue
        if (!map.has(t.artist)) {
          map.set(t.artist, { name: t.artist, albums: [], tracks: [] })
        }
        map.get(t.artist)!.tracks.push(t)
      }
      for (const artist of map.values()) {
        const albumMap = new Map<string, LibraryAlbum>()
        for (const t of artist.tracks) {
          if (!albumMap.has(t.album)) {
            albumMap.set(t.album, { name: t.album, artist: artist.name, year: t.year, coverPath: t.coverPath, tracks: [] })
          }
          albumMap.get(t.album)!.tracks.push(t)
        }
        artist.albums = [...albumMap.values()].sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
        artist.coverPath = artist.tracks.find(t => t.coverPath)?.coverPath
      }
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
    },

    podcasts: (state): LibraryAlbum[] => {
      const map = new Map<string, LibraryAlbum>()
      for (const t of state.tracks) {
        if (t.source !== 'podcast') continue
        if (!map.has(t.album)) {
          map.set(t.album, { name: t.album, artist: t.artist, coverPath: t.coverPath, tracks: [] })
        }
        const entry = map.get(t.album)!
        if (!entry.coverPath && t.coverPath) entry.coverPath = t.coverPath
        entry.tracks.push(t)
      }
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
    },

    musicTracks: (state): LibraryTrack[] => {
      // Build a folder→coverPath map so tracks without embedded art
      // still show the folder's cover.jpg from a sibling track
      const folderCover = new Map<string, string>()
      for (const t of state.tracks) {
        if (t.source !== 'music' || !t.coverPath) continue
        const sep = t.path.includes('\\') ? '\\' : '/'
        const folder = t.path.split(sep).slice(0, -1).join(sep)
        if (!folderCover.has(folder)) folderCover.set(folder, t.coverPath)
      }
      return state.tracks
        .filter(t => t.source === 'music')
        .map(t => {
          if (t.coverPath) return t
          const sep = t.path.includes('\\') ? '\\' : '/'
          const folder = t.path.split(sep).slice(0, -1).join(sep)
          const shared = folderCover.get(folder)
          return shared ? { ...t, coverPath: shared } : t
        })
    },
    videoTracks: (state) => state.tracks.filter(t => t.source === 'video'),
  },

  actions: {
    async scan() {
      this.scanning = true
      try {
        const result = await window.nyro.invoke<{ tracks: LibraryTrack[]; scannedAt: number }>('library:scan')
        this.tracks = result.tracks
        this.scannedAt = result.scannedAt
      } finally {
        this.scanning = false
      }
    },
    async load() {
      const result = await window.nyro.invoke<{ tracks: LibraryTrack[]; scannedAt: number } | null>('library:get')
      if (result) {
        this.tracks = result.tracks
        this.scannedAt = result.scannedAt
      }
    },
    async deleteTracks(paths: string[]): Promise<void> {
      await window.nyro.invoke('library:delete-tracks', paths)
      const pathSet = new Set(paths)
      this.tracks = this.tracks.filter(t => !pathSet.has(t.path))
    },
    async setCover(trackPath: string, imagePath: string): Promise<string> {
      const coverPath = await window.nyro.invoke<string>('library:set-cover', trackPath, imagePath)
      const track = this.tracks.find(t => t.path === trackPath)
      if (track) track.coverPath = coverPath
      return coverPath
    },
    async renameFolder(oldPath: string, newName: string): Promise<string> {
      const newPath = await window.nyro.invoke<string>('library:rename-folder', oldPath, newName)
      for (const t of this.tracks) {
        if (t.path.startsWith(oldPath + '/') || t.path.startsWith(oldPath + '\\')) {
          t.path = newPath + t.path.slice(oldPath.length)
          t.album = newName
          // Only patch file-system cover paths (nyro-thumb:// covers are stored in SQLite by ID — path-independent)
          if (t.coverPath && !t.coverPath.startsWith('nyro-thumb://') && !t.coverPath.startsWith('nyro-file://') && t.coverPath.startsWith(oldPath)) {
            t.coverPath = newPath + t.coverPath.slice(oldPath.length)
          }
        }
      }
      return newPath
    },
  }
})
