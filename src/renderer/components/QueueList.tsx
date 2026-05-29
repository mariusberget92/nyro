import { AnimatePresence, motion } from 'framer-motion'
import { useQueueStore } from '../stores/queueStore'
import { useIpc } from '../hooks/useIpc'
import { useToastStore } from '../stores/toastStore'
import { QueueItem } from './QueueItem'
import { useCallback } from 'react'

export function QueueList(): JSX.Element {
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
        className="flex flex-col items-center justify-center py-16 text-surface-500"
      >
        <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <p className="text-sm">Queue is empty</p>
        <p className="text-xs mt-1">Add a YouTube URL above to get started</p>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <QueueItem key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  )
}
