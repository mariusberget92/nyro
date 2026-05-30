import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'

interface Toast { id: string; message: string; type: 'success' | 'error' | 'info' }

export const useToastStore = defineStore('toast', {
  state: () => ({ toasts: [] as Toast[] }),
  actions: {
    add(message: string, type: Toast['type'] = 'info') {
      const id = uuidv4()
      this.toasts.push({ id, message, type })
      setTimeout(() => this.remove(id), 4000)
    },
    remove(id: string) { this.toasts = this.toasts.filter(t => t.id !== id) },
  }
})
