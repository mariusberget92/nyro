import { motion } from 'framer-motion'
import { PlayIcon, PauseIcon, StopIcon, TrashIcon } from '@heroicons/react/24/outline'
import { DownloadForm } from '../components/DownloadForm'
import { QueueList } from '../components/QueueList'
import { useQueueStore } from '../stores/queueStore'
import { pageVariants } from '../animations/variants'
import type { QueueStatus } from '@shared/types/queue'

function QueueSummary(): JSX.Element {
  const items = useQueueStore((s) => s.items)
  const counts = items.reduce<Record<QueueStatus, number>>(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    },
    {} as Record<QueueStatus, number>
  )

  const total = items.length
  const completed = counts['completed'] || 0
  const failed = counts['failed'] || 0
  const active = (counts['downloading'] || 0) + (counts['converting'] || 0) + (counts['tagging'] || 0) + (counts['fetching'] || 0)
  const pending = counts['pending'] || 0

  return (
    <div className="flex items-center gap-4 text-xs text-surface-400">
      <span>{total} total</span>
      {active > 0 && <span className="text-blue-400">{active} active</span>}
      {pending > 0 && <span className="text-surface-300">{pending} pending</span>}
      {completed > 0 && <span className="text-emerald-400">{completed} done</span>}
      {failed > 0 && <span className="text-red-400">{failed} failed</span>}
    </div>
  )
}

export function Dashboard(): JSX.Element {
  const items = useQueueStore((s) => s.items)
  const isProcessing = useQueueStore((s) => s.isProcessing)
  const isPaused = useQueueStore((s) => s.isPaused)
  const pauseQueue = useQueueStore((s) => s.pauseQueue)
  const resumeQueue = useQueueStore((s) => s.resumeQueue)
  const stopQueue = useQueueStore((s) => s.stopQueue)
  const clearCompleted = useQueueStore((s) => s.clearCompleted)

  const hasItems = items.length > 0
  const hasCompletedOrFailed = items.some((i) => ['completed', 'cancelled', 'failed'].includes(i.status))

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col h-full p-6 overflow-hidden"
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white mb-1">Download Queue</h1>
        <p className="text-sm text-surface-400">Add YouTube URLs to download as high-quality MP3s</p>
      </div>

      {/* URL Form */}
      <div className="mb-6">
        <DownloadForm />
      </div>

      {/* Queue controls */}
      {hasItems && (
        <div className="flex items-center justify-between mb-3">
          <QueueSummary />
          <div className="flex items-center gap-2">
            {isProcessing && !isPaused && (
              <button
                onClick={() => pauseQueue()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-surface-300 hover:text-white bg-surface-800 hover:bg-surface-700 rounded transition-colors"
              >
                <PauseIcon className="w-3.5 h-3.5" />
                Pause
              </button>
            )}
            {isPaused && (
              <button
                onClick={() => resumeQueue()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-surface-800 hover:bg-surface-700 rounded transition-colors"
              >
                <PlayIcon className="w-3.5 h-3.5" />
                Resume
              </button>
            )}
            {(isProcessing) && (
              <button
                onClick={() => stopQueue()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-surface-800 hover:bg-surface-700 rounded transition-colors"
              >
                <StopIcon className="w-3.5 h-3.5" />
                Stop
              </button>
            )}
            {hasCompletedOrFailed && (
              <button
                onClick={() => clearCompleted()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-surface-400 hover:text-white bg-surface-800 hover:bg-surface-700 rounded transition-colors"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                Clear done
              </button>
            )}
          </div>
        </div>
      )}

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto">
        <QueueList />
      </div>
    </motion.div>
  )
}
