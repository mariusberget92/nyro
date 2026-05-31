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
        const key = `${t.album}__${t.artist}`
        if (!map.has(key)) {
          map.set(key, { name: t.album, artist: t.artist, year: t.year, coverPath: t.coverPath, tracks: [] })
        }
        map.get(key)!.tracks.push(t)
      }
      // Sort tracks within each album by track number
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
      // Build album list per artist
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
        map.get(t.album)!.tracks.push(t)
      }
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
    },

    musicTracks: (state) => state.tracks.filter(t => t.source === 'music'),
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
    async setCover(trackPath: string, imagePath: string): Promise<string> {
      const coverPath = await window.nyro.invoke<string>('library:set-cover', trackPath, imagePath)
      const track = this.tracks.find(t => t.path === trackPath)
      if (track) track.coverPath = coverPath
      return coverPath
    },
    async renameFolder(oldPath: string, newName: string): Promise<string> {
      const newPath = await window.nyro.invoke<string>('library:rename-folder', oldPath, newName)
      // Patch tracks in-memory so UI updates without a full rescan
      for (const t of this.tracks) {
        if (t.path.startsWith(oldPath)) {
          t.path = newPath + t.path.slice(oldPath.length)
          if (t.coverPath) t.coverPath = newPath + t.coverPath.slice(oldPath.length)
          t.album = newName
        }
      }
      return newPath
    },
  }
})
