import { AnimatePresence, motion } from 'framer-motion'
import { useQueueStore } from '../stores/queueStore'
import { useIpc } from '../hooks/useIpc'
import { useToastStore } from '../stores/toastStore'
import { QueueItem } from './QueueItem'
import { useCallback } from 'react'
import type { QueueItem as QueueItemType } from '@shared/types/queue'

interface QueueListProps {
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onEdit: (item: QueueItemType) => void
}

export function QueueList({ selectedIds, onToggleSelect, onEdit }: QueueListProps): JSX.Element {
  const items = useQueueStore((s) => s.items)
  const updateProgress = useQueueStore((s) => s.updateProgress)
  const updateStatus = useQueueStore((s) => s.updateStatus)
  const markCompleted = useQueueStore((s) => s.markCompleted)
  const markFailed = useQueueStore((s) => s.markFailed)
  const toast = useToastStore()

  useIpc('queue:progress', useCallback(({ id, progress, status }) => {
    updateProgress(id, progress, status)
  }, [updateProgress]))

  useIpc('queue:status-changed', useCallback(({ id, status }) => {
    updateStatus(id, status)
  }, [updateStatus]))

  useIpc('queue:completed', useCallback(({ id, outputPath }) => {
    markCompleted(id, outputPath)
    toast.success('Download complete!')
  }, [markCompleted, toast]))

  useIpc('queue:error', useCallback(({ id, error }) => {
    markFailed(id, error)
    toast.error(`Download failed: ${error}`)
  }, [markFailed, toast]))

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-24"
        style={{ color: 'var(--tx-faint)' }}
      >
        <svg className="w-12 h-12 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <p className="text-sm font-semibold" style={{ color: 'var(--tx-dim)' }}>Queue is empty</p>
        <p className="text-xs mt-1" style={{ color: 'var(--tx-faint)' }}>Add a YouTube URL above to get started</p>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col">
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <QueueItem
            key={item.id}
            item={item}
            index={index}
            selected={selectedIds.has(item.id)}
            onToggleSelect={onToggleSelect}
            onEdit={onEdit}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
