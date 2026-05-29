import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (message, type = 'info', duration = 4000) => {
    const id = uuidv4()
    set((state) => ({ toasts: [...state.toasts, { id, type, message, duration }] }))

    if (duration > 0) {
      setTimeout(() => get().removeToast(id), duration)
    }
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },

  success: (message) => get().addToast(message, 'success'),
  error: (message) => get().addToast(message, 'error', 6000),
  info: (message) => get().addToast(message, 'info'),
  warning: (message) => get().addToast(message, 'warning')
}))
