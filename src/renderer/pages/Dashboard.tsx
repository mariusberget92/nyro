import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  TrashIcon,
  FunnelIcon,
  BoltIcon
} from '@heroicons/react/24/outline'
import { DownloadForm } from '../components/DownloadForm'
import { QueueList } from '../components/QueueList'
import { BatchBar } from '../components/BatchBar'
import { EditSheet } from '../components/EditSheet'
import { useQueueStore } from '../stores/queueStore'
import { useSettingsStore } from '../stores/settingsStore'
import { pageVariants } from '../animations/variants'
import type { QueueItem } from '@shared/types/queue'

export function Dashboard(): JSX.Element {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editItem, setEditItem] = useState<QueueItem | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const items = useQueueStore((s) => s.items)
  const isProcessing = useQueueStore((s) => s.isProcessing)
  const isPaused = useQueueStore((s) => s.isPaused)
  const startQueue = useQueueStore((s) => s.startQueue)
  const pauseQueue = useQueueStore((s) => s.pauseQueue)
  const resumeQueue = useQueueStore((s) => s.resumeQueue)
  const stopQueue = useQueueStore((s) => s.stopQueue)
  const clearCompleted = useQueueStore((s) => s.clearCompleted)
  const settings = useSettingsStore((s) => s.settings)

  const hasCompletedOrFailed = items.some((i) =>
    ['completed', 'cancelled', 'failed'].includes(i.status)
  )
  const pendingCount = items.filter((i) =>
    !['completed', 'cancelled', 'failed'].includes(i.status)
  ).length
  const quality = settings?.audioQuality ?? '320'

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSaveEdit = useCallback((_id: string, _artist: string, _title: string) => {
    // In a full impl, update metadata via IPC
  }, [])

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="relative flex flex-col h-full overflow-hidden"
    >
      {/* Toolbar */}
      <div
        className="flex items-center px-5 shrink-0"
        style={{
          height: 56,
          background: 'var(--bg-0)',
          borderBottom: '1px solid var(--line)',
          gap: 8
        }}
      >
        <h1 style={{ fontSize: 17, fontWeight: 800, color: 'var(--tx)', flex: 'none' }}>
          Queue
        </h1>

        {pendingCount > 0 && (
          <span
            className="font-mono"
            style={{ fontSize: 11, color: 'var(--tx-faint)', marginLeft: 4 }}
          >
            {pendingCount} pending
          </span>
        )}

        <div className="flex-1" />

        {/* Right controls */}
        <div className="flex items-center gap-1">
          <IconBtn onClick={() => setShowAddForm((v) => !v)} title="Add URL">
            <FunnelIcon className="w-4 h-4" />
          </IconBtn>

          {hasCompletedOrFailed && (
            <IconBtn onClick={() => clearCompleted()} title="Clear completed">
              <TrashIcon className="w-4 h-4" />
            </IconBtn>
          )}

          <div style={{ width: 1, height: 20, background: 'var(--line-2)', margin: '0 4px' }} />

          {!isProcessing && (
            <PrimaryBtn
              onClick={() => startQueue()}
              icon={<BoltIcon className="w-4 h-4" />}
            >
              Run queue
            </PrimaryBtn>
          )}

          {isProcessing && !isPaused && (
            <IconBtn onClick={() => pauseQueue()} title="Pause">
              <PauseIcon className="w-4 h-4" />
            </IconBtn>
          )}

          {isPaused && (
            <IconBtn onClick={() => resumeQueue()} title="Resume">
              <PlayIcon className="w-4 h-4" />
            </IconBtn>
          )}

          {isProcessing && (
            <IconBtn onClick={() => stopQueue()} title="Stop" danger>
              <StopIcon className="w-4 h-4" />
            </IconBtn>
          )}
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div
          className="px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-1)' }}
        >
          <DownloadForm />
        </div>
      )}

      {/* Queue table */}
      <div className="flex-1 overflow-y-auto">
        <QueueList
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onEdit={setEditItem}
        />
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-5 shrink-0"
        style={{
          height: 36,
          borderTop: '1px solid var(--line)',
          background: 'var(--bg-0)'
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--tx-faint)' }}>
          {items.length} {items.length === 1 ? 'item' : 'items'} in queue
        </span>
        <span
          className="font-mono font-bold"
          style={{ fontSize: 11, color: 'var(--accent)' }}
        >
          MP3 · {quality} kbps
        </span>
      </div>

      {/* Batch bar */}
      <BatchBar selectedIds={selectedIds} onClear={() => setSelectedIds(new Set())} />

      {/* Edit sheet */}
      <EditSheet
        item={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleSaveEdit}
      />
    </motion.div>
  )
}

function IconBtn({
  onClick,
  title,
  children,
  danger
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
  danger?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center rounded-lg transition-colors"
      style={{
        width: 32,
        height: 32,
        color: danger ? 'var(--bad)' : 'var(--tx-dim)',
        background: 'transparent'
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-3)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

function PrimaryBtn({
  onClick,
  icon,
  children
}: {
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 font-semibold transition-all"
      style={{
        padding: '10px 20px',
        background: 'var(--accent)',
        color: '#fff',
        borderRadius: 'var(--radius)',
        fontSize: 12.5,
        border: 'none',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.15)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = 'none' }}
    >
      {icon}
      {children}
    </button>
  )
}
