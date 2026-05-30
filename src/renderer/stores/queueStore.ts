import { defineStore } from 'pinia'
import type { QueueItem, QueueStatus } from '@shared/types/queue'

export const useQueueStore = defineStore('queue', {
  state: () => ({
    items: [] as QueueItem[],
    isProcessing: false,
    isPaused: false,
  }),
  getters: {
    pendingCount: (state) => state.items.filter(i => !['completed', 'cancelled', 'failed'].includes(i.status)).length,
    activeItems: (state) => state.items.filter(i => !['completed', 'cancelled', 'failed'].includes(i.status)),
  },
  actions: {
    async loadQueue() {
      if (!window.nyro) return
      this.items = await window.nyro.invoke<QueueItem[]>('queue:get-all')
    },
    async addUrl(url: string) {
      const newItems = await window.nyro.invoke<QueueItem[]>('queue:add', url)
      const existingIds = new Set(newItems.map(i => i.id))
      this.items = [...this.items.filter(i => !existingIds.has(i.id)), ...newItems]
    },
    async removeItem(id: string) {
      await window.nyro.invoke('queue:remove', id)
      this.items = this.items.filter(i => i.id !== id)
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
      this.items = this.items.filter(i => !['completed', 'cancelled', 'failed'].includes(i.status))
    },
    async clearAll() {
      await window.nyro.invoke('queue:clear-all')
      this.items = []
      this.isProcessing = false
      this.isPaused = false
    },
    updateProgress(id: string, progress: number, status: QueueStatus) {
      const item = this.items.find(i => i.id === id)
      if (item) { item.progress = progress; item.status = status }
    },
    updateStatus(id: string, status: QueueStatus) {
      const item = this.items.find(i => i.id === id)
      if (item) item.status = status
      const terminal = ['completed', 'cancelled', 'failed']
      if (this.items.every(i => terminal.includes(i.status))) this.isProcessing = false
    },
    markCompleted(id: string, outputPath: string) {
      const item = this.items.find(i => i.id === id)
      if (item) { item.status = 'completed'; item.progress = 100; item.outputPath = outputPath }
    },
    markFailed(id: string, error: string) {
      const item = this.items.find(i => i.id === id)
      if (item) { item.status = 'failed'; item.error = error; item.progress = 0 }
    },
    toggleLike(id: string) {
      const item = this.items.find(i => i.id === id)
      if (item) item.liked = !item.liked
    },
  }
})
