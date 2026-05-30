import { defineStore } from 'pinia'
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/types/settings'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: { ...DEFAULT_SETTINGS } as AppSettings,
    density: 'comfortable' as 'comfortable' | 'compact',
    cornerRadius: 10,
    accentColor: '#3D7FFF',
  }),
  actions: {
    async load() {
      if (!window.nyro) return
      this.settings = await window.nyro.invoke<AppSettings>('settings:get')
    },
    async update(partial: Partial<AppSettings>) {
      Object.assign(this.settings, partial)
      await window.nyro.invoke('settings:set', partial)
    },
    async selectFolder() {
      const folder = await window.nyro.invoke<string | null>('dialog:select-folder')
      if (folder) await this.update({ outputFolder: folder })
    },
    setDensity(d: 'comfortable' | 'compact') { this.density = d },
    setRadius(r: number) {
      this.cornerRadius = r
      document.documentElement.style.setProperty('--radius', `${r}px`)
    },
    setAccent(c: string) {
      this.accentColor = c
      document.documentElement.style.setProperty('--accent', c)
    },
  }
})
