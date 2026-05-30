import { motion } from 'framer-motion'
import type { QueueStatus } from '@shared/types/queue'

interface ProgressBarProps {
  progress: number
  status: QueueStatus
}

function getBarColor(status: QueueStatus): string {
  if (status === 'converting' || status === 'tagging') return 'var(--conv)'
  if (status === 'completed') return 'var(--ok)'
  if (status === 'failed') return 'var(--bad)'
  if (status === 'paused') return 'var(--warn)'
  return 'var(--accent)'
}

export function ProgressBar({ progress, status }: ProgressBarProps): JSX.Element {
  const pct = Math.min(100, Math.max(0, progress))
  const color = getBarColor(status)

  return (
    <div
      className="absolute bottom-0 left-0 right-0"
      style={{ height: 2, background: 'rgba(255,255,255,0.05)' }}
    >
      <motion.div
        className="h-full"
        style={{ background: color }}
        initial={{ width: '0%' }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  )
}
