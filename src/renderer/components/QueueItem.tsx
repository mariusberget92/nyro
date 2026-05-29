import { motion } from 'framer-motion'
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, MusicalNoteIcon } from '@heroicons/react/24/outline'
import type { QueueItem as QueueItemType } from '@shared/types/queue'
import { queueItemVariants } from '../animations/variants'
import { ProgressBar } from './ProgressBar'
import { StatusBadge } from './StatusBadge'
import { useQueueStore } from '../stores/queueStore'

interface QueueItemProps {
  item: QueueItemType
}

function getProgressColor(status: QueueItemType['status']): 'blue' | 'green' | 'yellow' | 'red' {
  if (status === 'completed') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'paused') return 'yellow'
  return 'blue'
}

export function QueueItem({ item }: QueueItemProps): JSX.Element {
  const removeItem = useQueueStore((s) => s.removeItem)

  const isActive = ['fetching', 'downloading', 'converting', 'tagging'].includes(item.status)
  const showProgress = isActive || item.status === 'completed'

  return (
    <motion.div
      layout
      variants={queueItemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex items-center gap-3 px-4 py-3 bg-surface-900 border border-surface-800 rounded-lg"
    >
      {/* Icon */}
      <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded bg-surface-800">
        {item.status === 'completed' ? (
          <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
        ) : item.status === 'failed' ? (
          <ExclamationCircleIcon className="w-5 h-5 text-red-400" />
        ) : (
          <MusicalNoteIcon className="w-5 h-5 text-surface-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-white truncate">
            {item.metadata ? `${item.metadata.artist} – ${item.metadata.title}` : item.url}
          </span>
          <StatusBadge status={item.status} className="shrink-0" />
        </div>

        {item.error && (
          <p className="text-xs text-red-400 truncate mb-1">{item.error}</p>
        )}

        {showProgress && (
          <ProgressBar
            progress={item.progress}
            color={getProgressColor(item.status)}
            className="mt-1"
          />
        )}

        {item.metadata && !showProgress && (
          <p className="text-xs text-surface-400">
            {item.metadata.duration
              ? `${Math.floor(item.metadata.duration / 60)}:${String(Math.floor(item.metadata.duration % 60)).padStart(2, '0')}`
              : ''}
          </p>
        )}
      </div>

      {/* Actions */}
      <button
        onClick={() => removeItem(item.id)}
        className="shrink-0 p-1.5 rounded text-surface-500 hover:text-red-400 hover:bg-surface-800 transition-colors"
        title="Remove"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </motion.div>
  )
}
