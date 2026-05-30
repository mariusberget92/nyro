import type { QueueStatus } from '@shared/types/queue'

interface StatusBadgeProps {
  status: QueueStatus
  className?: string
}

type StatusCfg = {
  label: string
  color: string
  icon: string
}

const statusConfig: Record<QueueStatus, StatusCfg> = {
  pending:     { label: 'Queued',      color: 'var(--tx-faint)', icon: '○' },
  fetching:    { label: 'Fetching',    color: 'var(--accent)',   icon: '◎' },
  downloading: { label: 'Downloading', color: 'var(--accent)',   icon: '↓' },
  converting:  { label: 'Converting',  color: 'var(--conv)',     icon: '⟳' },
  tagging:     { label: 'Tagging',     color: 'var(--conv)',     icon: '✎' },
  completed:   { label: 'Done',        color: 'var(--ok)',       icon: '✓' },
  paused:      { label: 'Paused',      color: 'var(--warn)',     icon: '⏸' },
  cancelled:   { label: 'Cancelled',   color: 'var(--tx-faint)', icon: '✕' },
  failed:      { label: 'Failed',      color: 'var(--bad)',      icon: '✕' }
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps): JSX.Element {
  const cfg = statusConfig[status] ?? statusConfig.pending
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10.5px] font-bold uppercase tracking-wide shrink-0 ${className}`}
      style={{
        color: cfg.color,
        background: `color-mix(in srgb, ${cfg.color} 15%, transparent)`
      }}
    >
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  )
}
