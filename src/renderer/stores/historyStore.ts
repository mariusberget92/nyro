import { defineStore } from 'pinia'
import type { LibraryTrack } from '@shared/types/library'

export interface HistoryEntry {
  track: LibraryTrack
  playedAt: number  // epoch ms
}

const STORAGE_KEY = 'nyro-play-history'
const MAX_ENTRIES = 500

function load(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

function save(entries: HistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export const useHistoryStore = defineStore('history', {
  state: () => ({
    entries: load() as HistoryEntry[],
  }),

  getters: {
    recentTracks: (state): HistoryEntry[] => [...state.entries].reverse().slice(0, 100),

    // Count plays per track path
    playCounts: (state): Map<string, number> => {
      const map = new Map<string, number>()
      for (const e of state.entries) {
        map.set(e.track.path, (map.get(e.track.path) ?? 0) + 1)
      }
      return map
    },

    topTracks: (state): { track: LibraryTrack; count: number }[] => {
      const map = new Map<string, { track: LibraryTrack; count: number }>()
      for (const e of state.entries) {
        const key = e.track.path
        if (map.has(key)) {
          map.get(key)!.count++
        } else {
          map.set(key, { track: e.track, count: 1 })
        }
      }
      return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 50)
    },
  },

  actions: {
    record(track: LibraryTrack) {
      this.entries.push({ track, playedAt: Date.now() })
      if (this.entries.length > MAX_ENTRIES) {
        this.entries = this.entries.slice(-MAX_ENTRIES)
      }
      save(this.entries)
    },

    clear() {
      this.entries = []
      save([])
    },
  },
})
