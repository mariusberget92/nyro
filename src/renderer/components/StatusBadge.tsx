import type { QueueStatus } from '@shared/types/queue'

interface StatusBadgeProps {
  status: QueueStatus
  className?: string
}

const statusConfig: Record<QueueStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-surface-700 text-surface-300' },
  fetching: { label: 'Fetching', className: 'bg-blue-900/50 text-blue-300' },
  downloading: { label: 'Downloading', className: 'bg-nyro-900/50 text-nyro-300' },
  converting: { label: 'Converting', className: 'bg-purple-900/50 text-purple-300' },
  tagging: { label: 'Tagging', className: 'bg-indigo-900/50 text-indigo-300' },
  completed: { label: 'Done', className: 'bg-emerald-900/50 text-emerald-400' },
  paused: { label: 'Paused', className: 'bg-yellow-900/50 text-yellow-400' },
  cancelled: { label: 'Cancelled', className: 'bg-surface-700 text-surface-400' },
  failed: { label: 'Failed', className: 'bg-red-900/50 text-red-400' }
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps): JSX.Element {
  const config = statusConfig[status]
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className} ${className}`}
    >
      {config.label}
    </span>
  )
}
