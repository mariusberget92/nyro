import { create } from 'zustand'
import type { AppSettings } from '@shared/types/settings'
import { DEFAULT_SETTINGS } from '@shared/types/settings'

export type Density = 'comfortable' | 'compact'

interface UISettings {
  density: Density
  cornerRadius: number
  accentColor: string
}

interface SettingsState {
  settings: AppSettings
  ui: UISettings
  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  selectOutputFolder: () => Promise<void>
  setDensity: (density: Density) => void
  setCornerRadius: (radius: number) => void
  setAccentColor: (color: string) => void
}

const DEFAULT_UI: UISettings = {
  density: 'comfortable',
  cornerRadius: 10,
  accentColor: '#3D7FFF'
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  ui: DEFAULT_UI,

  loadSettings: async () => {
    if (!window.nyro) return
    const settings = await window.nyro.invoke<AppSettings>('settings:get')
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
  },

  setDensity: (density) => {
    set((s) => ({ ui: { ...s.ui, density } }))
  },

  setCornerRadius: (cornerRadius) => {
    set((s) => ({ ui: { ...s.ui, cornerRadius } }))
    document.documentElement.style.setProperty('--radius', `${cornerRadius}px`)
  },

  setAccentColor: (accentColor) => {
    set((s) => ({ ui: { ...s.ui, accentColor } }))
    document.documentElement.style.setProperty('--accent', accentColor)
  }
}))
