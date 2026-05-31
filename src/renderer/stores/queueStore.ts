import { defineStore } from 'pinia'
import { shallowRef, triggerRef } from 'vue'
import type { QueueItem, QueueStatus } from '@shared/types/queue'

// Progress is stored outside the reactive store so that high-frequency
// IPC updates never touch the Pinia state or trigger full list re-renders.
// Cards read from this map directly via a shallowRef that's only updated
// on status transitions, not on every percentage tick.
export const progressMap = shallowRef(new Map<string, { progress: number; status: QueueStatus }>())

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
    async addUrl(url: string, outputFolder?: string) {
      const newItems = await window.nyro.invoke<QueueItem[]>('queue:add', url, outputFolder)
      const existingIds = new Set(newItems.map(i => i.id))
      this.items = [...this.items.filter(i => !existingIds.has(i.id)), ...newItems]
    },
    async removeItem(id: string) {
      await window.nyro.invoke('queue:remove', id)
      this.items = this.items.filter(i => i.id !== id)
      progressMap.value.delete(id)
      triggerRef(progressMap)
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
      progressMap.value.clear()
      triggerRef(progressMap)
    },

    // Called on every IPC progress event — writes ONLY to progressMap,
    // never touches Pinia reactive state → zero Vue re-renders from progress
    updateProgress(id: string, progress: number, status: QueueStatus) {
      progressMap.value.set(id, { progress, status })
      triggerRef(progressMap)
    },

    updateStatus(id: string, status: QueueStatus) {
      const item = this.items.find(i => i.id === id)
      if (item) item.status = status
      // Keep progressMap in sync for terminal states
      if (TERMINAL.has(status)) {
        progressMap.value.set(id, { progress: status === 'completed' ? 100 : 0, status })
        triggerRef(progressMap)
      }
      if (this.items.every(i => TERMINAL.has(i.status))) this.isProcessing = false
    },
    markCompleted(id: string, outputPath: string) {
      const item = this.items.find(i => i.id === id)
      if (item) { item.status = 'completed'; item.progress = 100; item.outputPath = outputPath }
      progressMap.value.set(id, { progress: 100, status: 'completed' })
      triggerRef(progressMap)
    },
    markFailed(id: string, error: string) {
      const item = this.items.find(i => i.id === id)
      if (item) { item.status = 'failed'; item.error = error; item.progress = 0 }
      progressMap.value.set(id, { progress: 0, status: 'failed' })
      triggerRef(progressMap)
    },
    toggleLike(id: string) {
      const item = this.items.find(i => i.id === id)
      if (item) item.liked = !item.liked
    },
  }
})
