import { motion } from 'framer-motion'
import { FolderOpenIcon } from '@heroicons/react/24/outline'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import { pageVariants } from '../animations/variants'
import type { Density } from '../stores/settingsStore'

function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <p
      className="uppercase tracking-wider mb-3"
      style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx-faint)' }}
    >
      {children}
    </p>
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
    <div
      className="flex items-center justify-between py-4"
      style={{ borderBottom: '1px solid var(--line)' }}
    >
      <div className="min-w-0 mr-4">
        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{label}</p>
        {description && (
          <p className="mt-0.5" style={{ fontSize: 11.5, color: 'var(--tx-faint)' }}>
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

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
      className="relative inline-flex items-center transition-colors"
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: checked ? 'var(--accent)' : 'var(--bg-3)',
        border: '1px solid var(--line-2)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
      <span
        className="inline-block rounded-full bg-white shadow transition-transform"
        style={{
          width: 16,
          height: 16,
          transform: checked ? 'translateX(20px)' : 'translateX(2px)'
        }}
      />
    </button>
  )
}

export function Settings(): JSX.Element {
  const { settings, updateSettings, selectOutputFolder, ui, setDensity, setCornerRadius, setAccentColor } = useSettingsStore()
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
      className="flex flex-col h-full overflow-y-auto"
    >
      {/* Toolbar */}
      <div
        className="flex items-center px-6 shrink-0"
        style={{
          height: 56,
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg-0)'
        }}
      >
        <h1 style={{ fontSize: 17, fontWeight: 800, color: 'var(--tx)' }}>Settings</h1>
      </div>

      <div className="p-6 max-w-xl">

        {/* Output */}
        <section className="mb-8">
          <SectionLabel>Output</SectionLabel>
          <div
            className="px-4"
            style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}
          >
            <SettingRow
              label="Output folder"
              description={settings.outputFolder || 'Click Browse to select a folder'}
            >
              <button
                onClick={selectOutputFolder}
                className="flex items-center gap-2 font-semibold transition-colors"
                style={{
                  padding: '7px 14px',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--line-2)',
                  borderRadius: 8,
                  color: 'var(--tx)',
                  fontSize: 12.5,
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-3)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-2)' }}
              >
                <FolderOpenIcon className="w-4 h-4" />
                Browse
              </button>
            </SettingRow>

            <SettingRow
              label="Numeric prefix"
              description="Prepend track number to filenames (e.g. 001 – Artist – Title.mp3)"
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
                className="transition-colors"
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--line-2)',
                  borderRadius: 8,
                  color: 'var(--tx)',
                  fontSize: 12.5,
                  padding: '6px 10px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="artist-title">Artist – Title</option>
                <option value="title-artist">Title – Artist</option>
                <option value="title">Title only</option>
              </select>
            </SettingRow>
          </div>
        </section>

        {/* Audio */}
        <section className="mb-8">
          <SectionLabel>Audio</SectionLabel>
          <div
            className="px-4"
            style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}
          >
            <SettingRow label="Audio quality" description="MP3 bitrate for converted files">
              <select
                value={settings.audioQuality}
                onChange={(e) => handleUpdate('audioQuality', e.target.value as typeof settings.audioQuality)}
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--line-2)',
                  borderRadius: 8,
                  color: 'var(--tx)',
                  fontSize: 12.5,
                  padding: '6px 10px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
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

        {/* Appearance */}
        <section className="mb-8">
          <SectionLabel>Appearance</SectionLabel>
          <div
            className="px-4"
            style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}
          >
            <SettingRow label="Density" description="Row size and spacing">
              <div className="flex gap-1">
                {(['comfortable', 'compact'] as Density[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDensity(d)}
                    className="font-semibold transition-colors"
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      borderRadius: 8,
                      background: ui.density === d ? 'var(--accent)' : 'var(--bg-2)',
                      color: ui.density === d ? '#fff' : 'var(--tx-dim)',
                      border: '1px solid var(--line-2)',
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow
              label="Corner radius"
              description={`${ui.cornerRadius}px`}
            >
              <input
                type="range"
                min={2}
                max={18}
                value={ui.cornerRadius}
                onChange={(e) => setCornerRadius(Number(e.target.value))}
                style={{ width: 120, accentColor: 'var(--accent)' }}
              />
            </SettingRow>

            <SettingRow label="Accent color">
              <input
                type="color"
                value={ui.accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                style={{
                  width: 40,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid var(--line-2)',
                  background: 'var(--bg-2)',
                  padding: 4,
                  cursor: 'pointer'
                }}
              />
            </SettingRow>
          </div>
        </section>

        {/* Advanced */}
        <section>
          <SectionLabel>Advanced</SectionLabel>
          <div
            className="px-4 opacity-50"
            style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}
          >
            <SettingRow
              label="Concurrent downloads"
              description="Parallel downloads — Coming soon"
            >
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={1}
                  disabled
                  style={{ width: 100, accentColor: 'var(--accent)', opacity: 0.5 }}
                />
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--tx-faint)' }}>1</span>
              </div>
            </SettingRow>
          </div>
        </section>
      </div>
    </motion.div>
  )
}
