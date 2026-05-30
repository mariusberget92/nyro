import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  QueueListIcon,
  Cog6ToothIcon,
  FolderIcon
} from '@heroicons/react/24/outline'
import { useQueueStore } from '../stores/queueStore'
import { useSettingsStore } from '../stores/settingsStore'

function NavIcon({
  to,
  icon: Icon,
  badge
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}): JSX.Element {
  return (
    <NavLink
      to={to}
      className="relative flex items-center justify-center"
      style={{ width: 44, height: 44 }}
    >
      {({ isActive }) => (
        <div
          className="relative flex items-center justify-center rounded-xl transition-all"
          style={{
            width: 40,
            height: 40,
            background: isActive ? 'var(--bg-3)' : 'transparent',
            color: isActive ? 'var(--accent)' : 'var(--tx-dim)'
          }}
          onMouseEnter={(e) => {
            if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-2)'
          }}
          onMouseLeave={(e) => {
            if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
          }}
        >
          <Icon className="w-5 h-5" />
          {badge != null && badge > 0 && (
            <span
              className="absolute -top-1 -right-1 flex items-center justify-center rounded-full font-mono text-[9px] font-bold"
              style={{
                minWidth: 16,
                height: 16,
                padding: '0 3px',
                background: 'var(--accent)',
                color: '#fff'
              }}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
      )}
    </NavLink>
  )
}

export function Rail(): JSX.Element {
  const items = useQueueStore((s) => s.items)
  const queueCount = items.filter((i) =>
    !['completed', 'cancelled', 'failed'].includes(i.status)
  ).length
  const settings = useSettingsStore((s) => s.settings)
  const audioQuality = settings?.audioQuality ?? '320'

  const folderPath = settings?.outputFolder ?? ''
  const shortPath = folderPath
    ? folderPath.split('/').pop() || folderPath.split('\\').pop() || folderPath
    : '~'

  return (
    <aside
      className="flex flex-col items-center shrink-0"
      style={{
        width: 60,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--line)'
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center py-4" style={{ height: 56 }}>
        <div
          className="flex items-center justify-center rounded-lg font-bold text-white"
          style={{ width: 28, height: 28, background: 'var(--accent)', fontSize: 13 }}
        >
          N
        </div>
      </div>

      {/* Nav icons */}
      <nav className="flex flex-col items-center gap-1 flex-1 pt-2">
        <NavIcon to="/dashboard" icon={MagnifyingGlassIcon} />
        <NavIcon to="/dashboard" icon={QueueListIcon} badge={queueCount} />
        <NavIcon to="/settings" icon={Cog6ToothIcon} />
      </nav>

      {/* Bottom: folder + quality */}
      <div className="flex flex-col items-center gap-2 pb-4">
        <button
          className="flex flex-col items-center justify-center gap-1 p-1 rounded-lg transition-colors"
          title={folderPath || 'Output folder'}
          style={{ color: 'var(--tx-faint)', background: 'transparent' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--tx-dim)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--tx-faint)' }}
        >
          <FolderIcon className="w-4 h-4" />
          <span
            className="font-mono text-center leading-tight"
            style={{ fontSize: 9, maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {shortPath}
          </span>
        </button>
        <span
          className="font-mono font-bold text-center"
          style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: '0.02em' }}
        >
          {audioQuality} kbps
        </span>
      </div>
    </aside>
  )
}

// Keep backward-compat export
export { Rail as Sidebar }
