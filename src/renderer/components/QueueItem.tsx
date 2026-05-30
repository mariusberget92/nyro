import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  MusicalNoteIcon,
  XMarkIcon,
  PauseIcon,
  PlayIcon,
  ArrowPathIcon,
  Bars3Icon
} from '@heroicons/react/24/outline'
import type { QueueItem as QueueItemType } from '@shared/types/queue'
import { queueItemVariants } from '../animations/variants'
import { ProgressBar } from './ProgressBar'
import { StatusBadge } from './StatusBadge'
import { useQueueStore } from '../stores/queueStore'
import { useSettingsStore } from '../stores/settingsStore'

interface QueueItemProps {
  item: QueueItemType
  index: number
  selected: boolean
  onToggleSelect: (id: string) => void
  onEdit: (item: QueueItemType) => void
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = String(Math.floor(secs % 60)).padStart(2, '0')
  return `${m}:${s}`
}

export function QueueItem({ item, index, selected, onToggleSelect, onEdit }: QueueItemProps): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const removeItem = useQueueStore((s) => s.removeItem)
  const pauseQueue = useQueueStore((s) => s.pauseQueue)
  const resumeQueue = useQueueStore((s) => s.resumeQueue)
  const density = useSettingsStore((s) => s.ui.density)

  const isCompact = density === 'compact'
  const rowH = isCompact ? 42 : 56
  const thumbSz = isCompact ? 30 : 40
  const pad = isCompact ? 14 : 18
  const gap = isCompact ? 10 : 14

  const isActive = ['fetching', 'downloading', 'converting', 'tagging'].includes(item.status)
  const showProgress = isActive || (item.status === 'paused' && item.progress > 0)

  const title = item.metadata?.title ?? item.url
  const artist = item.metadata?.artist ?? ''
  const duration = item.metadata?.duration ? formatDuration(item.metadata.duration) : ''
  const thumb = item.metadata?.thumbnailUrl

  return (
    <motion.div
      layout
      variants={queueItemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="relative flex items-center group"
      style={{
        height: rowH,
        paddingLeft: pad,
        paddingRight: pad,
        gap,
        background: selected ? 'var(--bg-3)' : hovered ? 'var(--bg-2)' : 'transparent',
        borderBottom: '1px solid var(--line)',
        cursor: 'default',
        transition: 'background 0.15s'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag grip — hover only */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{ width: 14, opacity: hovered ? 0.4 : 0, transition: 'opacity 0.15s', cursor: 'grab' }}
      >
        <Bars3Icon className="w-3.5 h-3.5" style={{ color: 'var(--tx-faint)' }} />
      </div>

      {/* Checkbox on hover */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{ width: 16, opacity: hovered || selected ? 1 : 0, transition: 'opacity 0.15s' }}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(item.id)}
          className="w-3.5 h-3.5 cursor-pointer"
          style={{ accentColor: 'var(--accent)' }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Index */}
      <span
        className="shrink-0 font-mono text-right select-none"
        style={{ color: 'var(--tx-faint)', width: 24, fontSize: 11 }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      {/* Thumbnail */}
      <div
        className="shrink-0 overflow-hidden flex items-center justify-center"
        style={{ width: thumbSz, height: thumbSz, background: 'var(--bg-3)', borderRadius: 8 }}
      >
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <MusicalNoteIcon className="w-4 h-4" style={{ color: 'var(--tx-faint)' }} />
        )}
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p
          className="truncate font-semibold leading-tight"
          style={{ fontSize: isCompact ? 12.5 : 13.5, color: 'var(--tx)' }}
        >
          {title}
        </p>
        {artist && (
          <p
            className="truncate leading-tight mt-0.5"
            style={{ fontSize: 11.5, color: 'var(--tx-dim)', fontWeight: 400 }}
          >
            {artist}
          </p>
        )}
        {item.error && (
          <p className="truncate leading-tight mt-0.5" style={{ fontSize: 11, color: 'var(--bad)' }}>
            {item.error}
          </p>
        )}
      </div>

      {/* Duration */}
      {duration && (
        <span
          className="shrink-0 font-mono"
          style={{ fontSize: 12, color: 'var(--tx-faint)' }}
        >
          {duration}
        </span>
      )}

      {/* Status badge — hidden on hover */}
      {!hovered && <StatusBadge status={item.status} />}

      {/* Row actions on hover */}
      {hovered && (
        <div className="flex items-center gap-1 shrink-0">
          {item.status === 'downloading' && (
            <IconBtn onClick={() => pauseQueue()} title="Pause">
              <PauseIcon className="w-3.5 h-3.5" />
            </IconBtn>
          )}
          {item.status === 'paused' && (
            <IconBtn onClick={() => resumeQueue()} title="Resume">
              <PlayIcon className="w-3.5 h-3.5" />
            </IconBtn>
          )}
          {item.status === 'failed' && (
            <IconBtn onClick={() => {}} title="Retry">
              <ArrowPathIcon className="w-3.5 h-3.5" />
            </IconBtn>
          )}
          <IconBtn onClick={() => onEdit(item)} title="Edit">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M11 2l3 3-9 9H2v-3L11 2z" strokeLinejoin="round" />
            </svg>
          </IconBtn>
          <IconBtn onClick={() => removeItem(item.id)} title="Remove" danger>
            <XMarkIcon className="w-3.5 h-3.5" />
          </IconBtn>
        </div>
      )}

      {/* Progress bar */}
      {showProgress && <ProgressBar progress={item.progress} status={item.status} />}
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
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={title}
      className="flex items-center justify-center rounded-lg transition-colors"
      style={{ width: 32, height: 32, color: danger ? 'var(--bad)' : 'var(--tx-dim)', background: 'transparent' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-3)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}
