import type {
  QueueItem,
  QueueProgressPayload,
  QueueStatusChangedPayload,
  QueueCompletedPayload,
  QueueErrorPayload
} from './queue'
import type { AppSettings } from './settings'
import type { LNSearchResult, LNPodcast } from './podcast'

// Renderer → Main (invoke channels)
export interface IpcInvokeChannels {
  'queue:add': (url: string) => Promise<QueueItem[]>
  'queue:remove': (id: string) => Promise<void>
  'queue:start': () => Promise<void>
  'queue:pause': () => Promise<void>
  'queue:resume': () => Promise<void>
  'queue:stop': () => Promise<void>
  'queue:clear-completed': () => Promise<void>
  'queue:clear-all': () => Promise<void>
  'queue:get-all': () => Promise<QueueItem[]>
  'settings:get': () => Promise<AppSettings>
  'settings:set': (settings: Partial<AppSettings>) => Promise<void>
  'dialog:select-folder': () => Promise<string | null>
  'podcast:search-shows': (query: string) => Promise<LNSearchResult>
  'podcast:search-episodes': (query: string) => Promise<LNSearchResult>
  'podcast:get-show': (idOrUrl: string, nextPubDate?: number) => Promise<LNPodcast>
  'podcast:add-episode': (episodeId: string) => Promise<QueueItem>
}

// Main → Renderer (on channels)
export interface IpcOnChannels {
  'queue:progress': QueueProgressPayload
  'queue:status-changed': QueueStatusChangedPayload
  'queue:completed': QueueCompletedPayload
  'queue:error': QueueErrorPayload
}

export type IpcInvokeChannel = keyof IpcInvokeChannels
export type IpcOnChannel = keyof IpcOnChannels
