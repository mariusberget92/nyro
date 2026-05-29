import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { QueueListIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { APP_NAME } from '@shared/constants'

const navItems = [
  { to: '/dashboard', label: 'Queue', icon: QueueListIcon },
  { to: '/settings', label: 'Settings', icon: Cog6ToothIcon }
]

export function Sidebar(): JSX.Element {
  return (
    <aside className="flex flex-col w-56 bg-surface-900 border-r border-surface-800 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-surface-800">
        <div className="w-7 h-7 rounded-lg bg-nyro-600 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">N</span>
        </div>
        <span className="font-semibold text-white text-sm tracking-wide">{APP_NAME}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'text-white bg-surface-800'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-surface-800"
                    style={{ zIndex: -1 }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                  />
                )}
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer version */}
      <div className="px-5 py-3 border-t border-surface-800">
        <p className="text-xs text-surface-600">v1.0.0</p>
      </div>
    </aside>
  )
}
