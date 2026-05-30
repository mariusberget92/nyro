/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}

declare global {
  interface Window {
    nyro: {
      invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>
      on(channel: string, listener: (payload: unknown) => void): () => void
    }
  }
}
