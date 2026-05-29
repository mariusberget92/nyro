import Store from 'electron-store'
import type { QueueItem } from '@shared/types/queue'
import type { AppSettings } from '@shared/types/settings'
import { DEFAULT_SETTINGS } from '@shared/types/settings'
import { app } from 'electron'
import { join } from 'path'
import { homedir } from 'os'

interface StoreSchema {
  queue: QueueItem[]
  settings: AppSettings
}

let _store: Store<StoreSchema> | null = null

export function getStore(): Store<StoreSchema> {
  if (!_store) {
    _store = new Store<StoreSchema>({
      name: 'nyro-data',
      defaults: {
        queue: [],
        settings: {
          ...DEFAULT_SETTINGS,
          outputFolder: getDefaultOutputFolder()
        }
      }
    })
  }
  return _store
}

function getDefaultOutputFolder(): string {
  try {
    return join(homedir(), 'Music', 'Nyro')
  } catch {
    return join(app.getPath('music'), 'Nyro')
  }
}

export function saveQueue(queue: QueueItem[]): void {
  getStore().set('queue', queue)
}

export function loadQueue(): QueueItem[] {
  return getStore().get('queue', [])
}

export function saveSettings(settings: AppSettings): void {
  getStore().set('settings', settings)
}

export function loadSettings(): AppSettings {
  const stored = getStore().get('settings')
  return { ...DEFAULT_SETTINGS, ...stored }
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = loadSettings()
  const updated = { ...current, ...partial }
  saveSettings(updated)
  return updated
}
