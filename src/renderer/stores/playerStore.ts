import { defineStore } from 'pinia'
import type { LibraryTrack } from '@shared/types/library'

export type RepeatMode = 'off' | 'all' | 'one'

export const usePlayerStore = defineStore('player', {
  state: () => ({
    queue: [] as LibraryTrack[],
    currentIndex: -1,
    playing: false,
    progress: 0,
    duration: 0,
    volume: 1,
    speed: 1,           // playback rate: 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2
    shuffle: false,
    repeat: 'off' as RepeatMode,
    shuffleOrder: [] as number[],
    lrcRaw: null as string | null,
    showLyrics: false,
    pendingSeek: null as number | null,  // seconds; consumed by MiniPlayer
    sleepEndsAt: null as number | null,  // epoch ms; null = timer off
  }),

  getters: {
    currentTrack: (state): LibraryTrack | null =>
      state.currentIndex >= 0 ? state.queue[state.currentIndex] ?? null : null,

    // Parse LRC into [{time: seconds, text: string}]
    lrcLines: (state): { time: number; text: string }[] => {
      if (!state.lrcRaw) return []
      return state.lrcRaw
        .split('\n')
        .map(line => {
          const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/)
          if (!m) return null
          return { time: parseInt(m[1]) * 60 + parseFloat(m[2]), text: m[3].trim() }
        })
        .filter(Boolean) as { time: number; text: string }[]
    },

    // Index of the currently active lyric line (0.3s look-ahead to compensate for
    // timeupdate granularity and LRC files that stamp lines slightly late)
    currentLyricIndex: (state): number => {
      const lines = (state as any).lrcLines as { time: number; text: string }[]
      if (!lines.length) return -1
      const now = state.progress * state.duration + 0.3
      let idx = -1
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].time <= now) idx = i
        else break
      }
      return idx
    },

    audioUrl: (state): string | null => {
      const t = state.currentIndex >= 0 ? state.queue[state.currentIndex] : null
      if (!t) return null
      return `nyro-file://local?p=${encodeURIComponent(t.path)}`
    },
  },

  actions: {
    async play(tracks: LibraryTrack[], startIndex = 0) {
      this.queue = tracks
      this.shuffleOrder = tracks.map((_, i) => i)
      if (this.shuffle) this._reshufflFrom(startIndex)
      this.currentIndex = startIndex
      this.playing = true
      this.lrcRaw = null
      await this._loadLrc(tracks[startIndex])
    },

    async playOne(track: LibraryTrack) {
      await this.play([track], 0)
    },

    togglePlay() {
      this.playing = !this.playing
    },

    async next() {
      if (this.repeat === 'one') { this.progress = 0; return }
      const nextIdx = this._nextIndex()
      if (nextIdx === -1) { this.playing = false; return }
      this.currentIndex = nextIdx
      this.progress = 0
      this.lrcRaw = null
      await this._loadLrc(this.queue[nextIdx])
    },

    async prev() {
      if (this.progress > 0.05) { this.pendingSeek = 0; this.progress = 0; return }
      const prevIdx = this._prevIndex()
      if (prevIdx === -1) return
      this.currentIndex = prevIdx
      this.progress = 0
      this.lrcRaw = null
      await this._loadLrc(this.queue[prevIdx])
    },

    toggleLyrics() { this.showLyrics = !this.showLyrics },

    async _loadLrc(track?: LibraryTrack) {
      if (!track?.lrcPath) { this.lrcRaw = null; return }
      try {
        this.lrcRaw = await window.nyro.invoke<string | null>('library:get-lrc', track.lrcPath)
      } catch {
        this.lrcRaw = null
      }
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

    setSpeed(rate: number) { this.speed = rate },
    setProgress(p: number) { this.progress = Math.max(0, Math.min(1, p)) },
    consumeSeek(): number | null { const s = this.pendingSeek; this.pendingSeek = null; return s },
    setDuration(d: number) { this.duration = d },
    setVolume(v: number)   { this.volume = Math.max(0, Math.min(1, v)) },
    seekBy(seconds: number) {
      if (!this.duration) return
      const current = this.progress * this.duration
      const next = Math.max(0, Math.min(this.duration, current + seconds))
      this.pendingSeek = next
      this.progress = next / this.duration
    },
    toggleMute() {
      this.volume = this.volume > 0 ? 0 : 0.7
    },

    setSleepTimer(minutes: number) {
      this.sleepEndsAt = minutes > 0 ? Date.now() + minutes * 60 * 1000 : null
    },
    clearSleepTimer() { this.sleepEndsAt = null },
    tickSleepTimer() {
      if (this.sleepEndsAt !== null && Date.now() >= this.sleepEndsAt) {
        this.playing = false
        this.sleepEndsAt = null
      }
    },

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
