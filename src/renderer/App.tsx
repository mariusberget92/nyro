import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Rail } from './components/Sidebar'
import { ToastContainer } from './components/ToastContainer'
import { Dashboard } from './pages/Dashboard'
import { Settings } from './pages/Settings'
import { useQueueStore } from './stores/queueStore'
import { useSettingsStore } from './stores/settingsStore'

export default function App(): JSX.Element {
  const loadQueue = useQueueStore((s) => s.loadQueue)
  const loadSettings = useSettingsStore((s) => s.loadSettings)

  useEffect(() => {
    loadQueue()
    loadSettings()
  }, [loadQueue, loadSettings])

  return (
    <HashRouter>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-canvas)', color: 'var(--tx)' }}>
        <Rail />
        <main className="flex-1 overflow-hidden flex flex-col" style={{ background: 'var(--bg-0)' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <ToastContainer />
      </div>
    </HashRouter>
  )
}
