import { motion } from 'framer-motion'

interface ProgressBarProps {
  progress: number
  className?: string
  color?: 'blue' | 'green' | 'yellow' | 'red'
}

const colorMap: Record<NonNullable<ProgressBarProps['color']>, string> = {
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500'
}

export function ProgressBar({ progress, className = '', color = 'blue' }: ProgressBarProps): JSX.Element {
  const clampedProgress = Math.min(100, Math.max(0, progress))

  return (
    <div className={`w-full h-1.5 bg-surface-700 rounded-full overflow-hidden ${className}`}>
      <motion.div
        className={`h-full rounded-full ${colorMap[color]}`}
        initial={{ width: '0%' }}
        animate={{ width: `${clampedProgress}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  )
}
