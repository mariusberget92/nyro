import { AnimatePresence, motion } from 'framer-motion'
import { PlayIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { batchBarVariants } from '../animations/variants'
import { useQueueStore } from '../stores/queueStore'

interface BatchBarProps {
  selectedIds: Set<string>
  onClear: () => void
}

export function BatchBar({ selectedIds, onClear }: BatchBarProps): JSX.Element {
  const count = selectedIds.size
  const removeItem = useQueueStore((s) => s.removeItem)
  const startQueue = useQueueStore((s) => s.startQueue)

  const handleRunSelected = async () => {
    await startQueue()
    onClear()
  }

  const handleRemoveSelected = async () => {
    for (const id of selectedIds) {
      await removeItem(id)
    }
    onClear()
  }

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          variants={batchBarVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 z-40"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--line-2)',
            borderRadius: 'var(--radius)',
            backdropFilter: 'blur(14px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}
        >
          <span className="font-semibold" style={{ fontSize: 12.5, color: 'var(--tx-dim)' }}>
            <span className="font-mono" style={{ color: 'var(--tx)' }}>{count}</span> selected
          </span>

          <div style={{ width: 1, height: 20, background: 'var(--line-2)' }} />

          <button
            onClick={handleRunSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 font-semibold transition-colors"
            style={{ fontSize: 12, color: 'var(--accent)', background: 'transparent', borderRadius: 8 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-3)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <PlayIcon className="w-3.5 h-3.5" />
            Run selected
          </button>

          <button
            onClick={handleRemoveSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 font-semibold transition-colors"
            style={{ fontSize: 12, color: 'var(--bad)', background: 'transparent', borderRadius: 8 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-3)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <TrashIcon className="w-3.5 h-3.5" />
            Remove
          </button>

          <button
            onClick={onClear}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ width: 28, height: 28, color: 'var(--tx-faint)', background: 'transparent' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-3)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
