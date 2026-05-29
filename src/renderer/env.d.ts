/// <reference types="vite/client" />

import type { NyroApi } from '../preload'

declare global {
  interface Window {
    nyro: NyroApi
  }
}
