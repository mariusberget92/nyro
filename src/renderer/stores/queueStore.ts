import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import type { QueueItem, QueueStatus } from '@shared/types/queue'

export type ProgressEntry = { progress: number; status: QueueStatus }

// Per-item shallowRefs so each card only re-renders when its own entry changes,
// not when any other item's progress ticks.
const _progressRefs = new Map<string, ReturnType<typeof shallowRef<ProgressEntry>>>()

export function getProgressRef(id: string) {
  if (!_progressRefs.has(id)) {
    _progressRefs.set(id, shallowRef<ProgressEntry | null>(null))
  }
  return _progressRefs.get(id)! as ReturnType<typeof shallowRef<ProgressEntry | null>>
}

function setProgress(id: string, entry: ProgressEntry) {
  getProgressRef(id).value = entry
}

function deleteProgressRef(id: string) {
  _progressRefs.delete(id)
}

// Keep the old export name so existing imports compile (used in QueueItem)
export const progressMap = { value: _progressRefs } as unknown as ReturnType<typeof shallowRef>

const TERMINAL = new Set(['completed', 'cancelled', 'failed'])

export const useQueueStore = defineStore('queue', {
  state: () => ({
    items: [] as QueueItem[],
    isProcessing: false,
    isPaused: false,
  }),
  getters: {
    pendingCount: (state) => state.items.filter(i => !TERMINAL.has(i.status)).length,
    activeItems:  (state) => state.items.filter(i => !TERMINAL.has(i.status)),
  },
  actions: {
    async loadQueue() {
      if (!window.nyro) return
      this.items = await window.nyro.invoke<QueueItem[]>('queue:get-all')
    },
    async addUrl(url: string, outputFolder?: string, albumOverride?: string) {
      const newItems = await window.nyro.invoke<QueueItem[]>('queue:add', url, outputFolder, albumOverride)
      const existingIds = new Set(newItems.map(i => i.id))
      this.items = [...this.items.filter(i => !existingIds.has(i.id)), ...newItems]
    },
    async removeItem(id: string) {
      await window.nyro.invoke('queue:remove', id)
      this.items = this.items.filter(i => i.id !== id)
      deleteProgressRef(id)
    },
    async startQueue() {
      this.isProcessing = true
      this.isPaused = false
      await window.nyro.invoke('queue:start')
    },
    async pauseQueue() {
      this.isPaused = true
      await window.nyro.invoke('queue:pause')
    },
    async resumeQueue() {
      this.isPaused = false
      this.isProcessing = true
      await window.nyro.invoke('queue:resume')
    },
    async stopQueue() {
      this.isProcessing = false
      this.isPaused = false
      await window.nyro.invoke('queue:stop')
    },
    async clearCompleted() {
      await window.nyro.invoke('queue:clear-completed')
      this.items = this.items.filter(i => !TERMINAL.has(i.status))
    },
    async clearAll() {
      await window.nyro.invoke('queue:clear-all')
      this.items = []
      this.isProcessing = false
      this.isPaused = false
      _progressRefs.clear()
    },

    // Called on every IPC progress event — writes only to the per-item ref,
    // so only that one card re-renders. Zero cost for all other 149 items.
    updateProgress(id: string, progress: number, status: QueueStatus) {
      setProgress(id, { progress, status })
    },

    updateStatus(id: string, status: QueueStatus) {
      const item = this.items.find(i => i.id === id)
      if (item) item.status = status
      if (TERMINAL.has(status)) {
        setProgress(id, { progress: status === 'completed' ? 100 : 0, status })
      }
      if (this.items.every(i => TERMINAL.has(i.status))) this.isProcessing = false
    },
    markCompleted(id: string, outputPath: string) {
      const item = this.items.find(i => i.id === id)
      if (item) { item.status = 'completed'; item.progress = 100; item.outputPath = outputPath }
      setProgress(id, { progress: 100, status: 'completed' })
    },
    markFailed(id: string, error: string) {
      const item = this.items.find(i => i.id === id)
      if (item) { item.status = 'failed'; item.error = error; item.progress = 0 }
      setProgress(id, { progress: 0, status: 'failed' })
    },
    toggleLike(id: string) {
      const item = this.items.find(i => i.id === id)
      if (item) item.liked = !item.liked
    },
  }
})
