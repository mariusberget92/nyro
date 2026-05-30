/// <reference types="vite/client" />

declare global {
  interface Window {
    nyro: {
      invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>
      on(channel: string, listener: (payload: unknown) => void): () => void
    }
  }
}
