import { defineStore } from 'pinia'

export type ViewMode = 'details' | 'list' | 'small' | 'medium' | 'large' | 'xlarge'

interface ViewState {
  queue: ViewMode
  library: ViewMode
  podcasts: ViewMode
  playlists: ViewMode
  history: ViewMode
}

const STORAGE_KEY = 'nyro-view-modes'

function load(): Partial<ViewState> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  catch { return {} }
}

const defaults: ViewState = {
  queue: 'medium',
  library: 'medium',
  podcasts: 'medium',
  playlists: 'medium',
  history: 'list',
}

export const useViewStore = defineStore('view', {
  state: () => ({ ...defaults, ...load() } as ViewState),

  actions: {
    set(page: keyof ViewState, mode: ViewMode) {
      this[page] = mode
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        queue: this.queue, library: this.library, podcasts: this.podcasts,
        playlists: this.playlists, history: this.history,
      }))
    },
  },
})
