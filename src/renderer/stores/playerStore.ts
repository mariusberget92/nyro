import { defineStore } from 'pinia'
import type { LibraryTrack } from '@shared/types/library'

export type RepeatMode = 'off' | 'all' | 'one'

export const usePlayerStore = defineStore('player', {
  state: () => ({
    queue: [] as LibraryTrack[],
    currentIndex: -1,
    playing: false,
    progress: 0,       // 0–1
    duration: 0,       // seconds
    volume: 1,
    shuffle: false,
    repeat: 'off' as RepeatMode,
    shuffleOrder: [] as number[],
  }),

  getters: {
    currentTrack: (state): LibraryTrack | null =>
      state.currentIndex >= 0 ? state.queue[state.currentIndex] ?? null : null,

    audioUrl: (state): string | null => {
      const t = state.currentIndex >= 0 ? state.queue[state.currentIndex] : null
      if (!t) return null
      // Encode the path for the custom protocol (forward-slash separators)
      const encoded = encodeURIComponent(t.path.replace(/\\/g, '/'))
      return `nyro-file://${encoded}`
    },
  },

  actions: {
    play(tracks: LibraryTrack[], startIndex = 0) {
      this.queue = tracks
      this.shuffleOrder = tracks.map((_, i) => i)
      if (this.shuffle) this._reshufflFrom(startIndex)
      this.currentIndex = startIndex
      this.playing = true
    },

    playOne(track: LibraryTrack) {
      this.play([track], 0)
    },

    togglePlay() {
      this.playing = !this.playing
    },

    next() {
      if (this.repeat === 'one') { this.progress = 0; return }
      const nextIdx = this._nextIndex()
      if (nextIdx === -1) { this.playing = false; return }
      this.currentIndex = nextIdx
      this.progress = 0
    },

    prev() {
      if (this.progress > 0.05) { this.progress = 0; return }
      const prevIdx = this._prevIndex()
      if (prevIdx === -1) return
      this.currentIndex = prevIdx
      this.progress = 0
    },

    cycleRepeat() {
      const modes: RepeatMode[] = ['off', 'all', 'one']
      const idx = modes.indexOf(this.repeat)
      this.repeat = modes[(idx + 1) % modes.length]
    },

    toggleShuffle() {
      this.shuffle = !this.shuffle
      if (this.shuffle && this.currentIndex >= 0) {
        this._reshufflFrom(this.currentIndex)
      }
    },

    setProgress(p: number) { this.progress = Math.max(0, Math.min(1, p)) },
    setDuration(d: number) { this.duration = d },
    setVolume(v: number)   { this.volume = Math.max(0, Math.min(1, v)) },

    _nextIndex(): number {
      if (this.queue.length === 0) return -1
      if (this.shuffle) {
        const pos = this.shuffleOrder.indexOf(this.currentIndex)
        const next = pos + 1
        if (next >= this.shuffleOrder.length) {
          return this.repeat === 'all' ? this.shuffleOrder[0] : -1
        }
        return this.shuffleOrder[next]
      }
      const next = this.currentIndex + 1
      if (next >= this.queue.length) return this.repeat === 'all' ? 0 : -1
      return next
    },

    _prevIndex(): number {
      if (this.queue.length === 0) return -1
      if (this.shuffle) {
        const pos = this.shuffleOrder.indexOf(this.currentIndex)
        return pos > 0 ? this.shuffleOrder[pos - 1] : this.shuffleOrder[0]
      }
      return Math.max(0, this.currentIndex - 1)
    },

    _reshufflFrom(anchorIndex: number) {
      const indices = this.queue.map((_, i) => i).filter(i => i !== anchorIndex)
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]]
      }
      this.shuffleOrder = [anchorIndex, ...indices]
    },
  }
})
