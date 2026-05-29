import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
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
      <div className="flex h-screen bg-surface-950 text-white overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
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
