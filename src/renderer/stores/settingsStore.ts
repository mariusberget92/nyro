import { create } from 'zustand'
import type { AppSettings } from '@shared/types/settings'
import { DEFAULT_SETTINGS } from '@shared/types/settings'

interface SettingsState {
  settings: AppSettings
  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  selectOutputFolder: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,

  loadSettings: async () => {
    const settings = await window.nyro.invoke('settings:get')
    set({ settings })
  },

  updateSettings: async (partial) => {
    const current = get().settings
    const updated = { ...current, ...partial }
    set({ settings: updated })
    await window.nyro.invoke('settings:set', partial)
  },

  selectOutputFolder: async () => {
    const folder = await window.nyro.invoke('dialog:select-folder')
    if (folder) {
      await get().updateSettings({ outputFolder: folder })
    }
  }
}))
