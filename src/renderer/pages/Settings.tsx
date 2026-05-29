import { motion } from 'framer-motion'
import { FolderOpenIcon } from '@heroicons/react/24/outline'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import { pageVariants } from '../animations/variants'

function Toggle({
  checked,
  onChange,
  disabled
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex w-10 h-5 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-nyro-600' : 'bg-surface-700'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function SettingRow({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex items-center justify-between py-4 border-b border-surface-800 last:border-0">
      <div className="min-w-0 mr-4">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-surface-400 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function Settings(): JSX.Element {
  const { settings, updateSettings, selectOutputFolder } = useSettingsStore()
  const toast = useToastStore()

  const handleUpdate = async <K extends keyof typeof settings>(
    key: K,
    value: (typeof settings)[K]
  ) => {
    await updateSettings({ [key]: value })
    toast.success('Settings saved')
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col h-full p-6 overflow-y-auto"
    >
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white mb-1">Settings</h1>
        <p className="text-sm text-surface-400">Configure your download preferences</p>
      </div>

      <div className="max-w-xl space-y-6">
        {/* Output */}
        <section>
          <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Output</h2>
          <div className="bg-surface-900 border border-surface-800 rounded-lg px-4">
            <SettingRow
              label="Output folder"
              description={settings.outputFolder || 'Click to select a folder'}
            >
              <button
                onClick={selectOutputFolder}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface-800 hover:bg-surface-700 text-sm text-white rounded transition-colors"
              >
                <FolderOpenIcon className="w-4 h-4" />
                Browse
              </button>
            </SettingRow>

            <SettingRow
              label="Numeric prefix"
              description="Prepend track number to filenames (e.g. 001 - Artist - Title.mp3)"
            >
              <Toggle
                checked={settings.numericPrefix}
                onChange={(v) => handleUpdate('numericPrefix', v)}
              />
            </SettingRow>

            <SettingRow label="Filename format">
              <select
                value={settings.filenameFormat}
                onChange={(e) => handleUpdate('filenameFormat', e.target.value as typeof settings.filenameFormat)}
                className="bg-surface-800 border border-surface-700 text-sm text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-nyro-500"
              >
                <option value="artist-title">Artist – Title</option>
                <option value="title-artist">Title – Artist</option>
                <option value="title">Title only</option>
              </select>
            </SettingRow>
          </div>
        </section>

        {/* Audio */}
        <section>
          <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Audio</h2>
          <div className="bg-surface-900 border border-surface-800 rounded-lg px-4">
            <SettingRow label="Audio quality" description="MP3 bitrate for converted files">
              <select
                value={settings.audioQuality}
                onChange={(e) => handleUpdate('audioQuality', e.target.value as typeof settings.audioQuality)}
                className="bg-surface-800 border border-surface-700 text-sm text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-nyro-500"
              >
                <option value="320">320 kbps</option>
                <option value="256">256 kbps</option>
                <option value="192">192 kbps</option>
                <option value="128">128 kbps</option>
              </select>
            </SettingRow>

            <SettingRow
              label="Fetch lyrics"
              description="Automatically embed lyrics from lrclib.net"
            >
              <Toggle
                checked={settings.fetchLyrics}
                onChange={(v) => handleUpdate('fetchLyrics', v)}
              />
            </SettingRow>
          </div>
        </section>

        {/* Advanced (grayed) */}
        <section>
          <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Advanced</h2>
          <div className="bg-surface-900 border border-surface-800 rounded-lg px-4 opacity-50">
            <SettingRow
              label="Concurrent downloads"
              description="Parallel downloads (coming in a future release)"
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={1}
                  disabled
                  className="w-16 bg-surface-800 border border-surface-700 text-sm text-white rounded px-2 py-1 text-center cursor-not-allowed"
                />
                <span className="text-xs text-surface-500">MVP: 1</span>
              </div>
            </SettingRow>
          </div>
        </section>
      </div>
    </motion.div>
  )
}
