import { create } from 'zustand'
import type { QueueItem, QueueStatus } from '@shared/types/queue'

interface QueueState {
  items: QueueItem[]
  isProcessing: boolean
  isPaused: boolean

  loadQueue: () => Promise<void>
  addUrl: (url: string) => Promise<void>
  removeItem: (id: string) => Promise<void>
  startQueue: () => Promise<void>
  pauseQueue: () => Promise<void>
  resumeQueue: () => Promise<void>
  stopQueue: () => Promise<void>
  clearCompleted: () => Promise<void>

  // Called from IPC listeners
  updateProgress: (id: string, progress: number, status: QueueStatus) => void
  updateStatus: (id: string, status: QueueStatus) => void
  markCompleted: (id: string, outputPath: string) => void
  markFailed: (id: string, error: string) => void
}

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  isProcessing: false,
  isPaused: false,

  loadQueue: async () => {
    const items = await window.nyro.invoke('queue:get-all')
    set({ items })
  },

  addUrl: async (url: string) => {
    const newItems = await window.nyro.invoke('queue:add', url)
    set((state) => ({
      items: [
        ...state.items.filter((i) => !newItems.some((n) => n.id === i.id)),
        ...newItems
      ]
    }))
  },

  removeItem: async (id: string) => {
    await window.nyro.invoke('queue:remove', id)
    set((state) => ({ items: state.items.filter((i) => i.id !== id) }))
  },

  startQueue: async () => {
    set({ isProcessing: true, isPaused: false })
    await window.nyro.invoke('queue:start')
  },

  pauseQueue: async () => {
    set({ isPaused: true })
    await window.nyro.invoke('queue:pause')
  },

  resumeQueue: async () => {
    set({ isPaused: false, isProcessing: true })
    await window.nyro.invoke('queue:resume')
  },

  stopQueue: async () => {
    set({ isProcessing: false, isPaused: true })
    await window.nyro.invoke('queue:stop')
  },

  clearCompleted: async () => {
    await window.nyro.invoke('queue:clear-completed')
    set((state) => ({
      items: state.items.filter((i) => !['completed', 'cancelled', 'failed'].includes(i.status))
    }))
  },

  updateProgress: (id, progress, status) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, progress, status } : item
      )
    }))
  },

  updateStatus: (id, status) => {
    const terminalStates: QueueStatus[] = ['completed', 'cancelled', 'failed']
    const allDone = get().items.every(
      (i) => i.id === id ? terminalStates.includes(status) : terminalStates.includes(i.status)
    )
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, status } : item
      ),
      isProcessing: !allDone
    }))
  },

  markCompleted: (id, outputPath) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { ...item, status: 'completed' as QueueStatus, progress: 100, outputPath, completedAt: Date.now() }
          : item
      )
    }))
  },

  markFailed: (id, error) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, status: 'failed' as QueueStatus, error, progress: 0 } : item
      )
    }))
  }
}))
