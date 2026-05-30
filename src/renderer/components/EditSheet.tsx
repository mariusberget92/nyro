import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { QueueItem } from '@shared/types/queue'
import { editSheetVariants } from '../animations/variants'

interface EditSheetProps {
  item: QueueItem | null
  onClose: () => void
  onSave: (id: string, artist: string, title: string) => void
}

export function EditSheet({ item, onClose, onSave }: EditSheetProps): JSX.Element {
  const [artist, setArtist] = useState('')
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (item) {
      setArtist(item.metadata?.artist ?? '')
      setTitle(item.metadata?.title ?? '')
    }
  }, [item])

  const filename = artist && title
    ? `${artist} – ${title}.mp3`
    : title
    ? `${title}.mp3`
    : 'untitled.mp3'

  const handleSave = () => {
    if (item) {
      onSave(item.id, artist, title)
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            variants={editSheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute top-0 right-0 bottom-0 z-40 flex flex-col"
            style={{
              width: 360,
              background: 'var(--bg-1)',
              borderLeft: '1px solid var(--line)',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.5)'
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--tx)' }}>Edit Track</h2>
              <button
                onClick={onClose}
                className="flex items-center justify-center rounded-lg transition-colors"
                style={{ width: 32, height: 32, color: 'var(--tx-dim)', background: 'transparent' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-3)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Fields */}
            <div className="flex-1 px-5 py-5 flex flex-col gap-4">
              <Field label="Artist" value={artist} onChange={setArtist} placeholder="Artist name" />
              <Field label="Song title" value={title} onChange={setTitle} placeholder="Song title" />

              {/* Filename preview */}
              <div className="mt-2">
                <p
                  className="uppercase tracking-wider mb-1.5"
                  style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx-faint)' }}
                >
                  Filename preview
                </p>
                <div
                  className="px-3 py-2 font-mono truncate"
                  style={{
                    fontSize: 11.5,
                    color: 'var(--tx-dim)',
                    background: 'var(--bg-2)',
                    borderRadius: 8,
                    border: '1px solid var(--line)'
                  }}
                >
                  {filename}
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div
              className="flex items-center justify-end gap-2 px-5 py-4"
              style={{ borderTop: '1px solid var(--line)' }}
            >
              <button
                onClick={onClose}
                className="px-4 py-2 font-semibold transition-colors"
                style={{
                  fontSize: 12.5,
                  color: 'var(--tx-dim)',
                  background: 'var(--bg-2)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--line-2)'
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-3)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-2)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 font-semibold transition-colors"
                style={{
                  fontSize: 12.5,
                  color: '#fff',
                  background: 'var(--accent)',
                  borderRadius: 'var(--radius)',
                  border: 'none'
                }}
              >
                Save changes
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="uppercase tracking-wider"
        style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx-faint)' }}
      >
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 transition-all"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--line-2)',
          borderRadius: 8,
          color: 'var(--tx)',
          fontSize: 13.5,
          outline: 'none'
        }}
        onFocus={(e) => {
          (e.target as HTMLInputElement).style.boxShadow = '0 0 0 2px var(--accent)'
          ;(e.target as HTMLInputElement).style.borderColor = 'var(--accent)'
        }}
        onBlur={(e) => {
          (e.target as HTMLInputElement).style.boxShadow = 'none'
          ;(e.target as HTMLInputElement).style.borderColor = 'var(--line-2)'
        }}
      />
    </div>
  )
}
