import { defineStore } from 'pinia'
import type { LibraryTrack } from '@shared/types/library'

export interface CustomPlaylist {
  id: string
  name: string
  description: string
  year: number
  createdAt: number
  tracks: LibraryTrack[]
}

const STORAGE_KEY = 'nyro-playlists'

function loadFromStorage(): CustomPlaylist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(playlists: CustomPlaylist[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists))
}

export const usePlaylistStore = defineStore('playlists', {
  state: () => ({
    playlists: loadFromStorage() as CustomPlaylist[],
  }),

  getters: {
    getById: (state) => (id: string) => state.playlists.find(p => p.id === id) ?? null,
  },

  actions: {
    create(name: string, description: string, year: number): CustomPlaylist {
      const pl: CustomPlaylist = {
        id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name, description, year, createdAt: Date.now(), tracks: [],
      }
      this.playlists.push(pl)
      saveToStorage(this.playlists)
      return pl
    },

    update(id: string, patch: Partial<Pick<CustomPlaylist, 'name' | 'description' | 'year'>>) {
      const pl = this.playlists.find(p => p.id === id)
      if (!pl) return
      Object.assign(pl, patch)
      saveToStorage(this.playlists)
    },

    remove(id: string) {
      this.playlists = this.playlists.filter(p => p.id !== id)
      saveToStorage(this.playlists)
    },

    addTrack(playlistId: string, track: LibraryTrack) {
      const pl = this.playlists.find(p => p.id === playlistId)
      if (!pl) return
      if (pl.tracks.find(t => t.id === track.id)) return
      pl.tracks.push(track)
      saveToStorage(this.playlists)
    },

    removeTrack(playlistId: string, trackId: string) {
      const pl = this.playlists.find(p => p.id === playlistId)
      if (!pl) return
      pl.tracks = pl.tracks.filter(t => t.id !== trackId)
      saveToStorage(this.playlists)
    },

    reorderTrack(playlistId: string, fromIdx: number, toIdx: number) {
      const pl = this.playlists.find(p => p.id === playlistId)
      if (!pl) return
      const [item] = pl.tracks.splice(fromIdx, 1)
      pl.tracks.splice(toIdx, 0, item)
      saveToStorage(this.playlists)
    },
  }
})
