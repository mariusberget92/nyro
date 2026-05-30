import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { PlusIcon } from '@heroicons/react/24/outline'
import { useQueueStore } from '../stores/queueStore'
import { useToastStore } from '../stores/toastStore'
import { YOUTUBE_URL_PATTERNS } from '@shared/constants'

type Tab = 'songs' | 'playlists'

export function DownloadForm(): JSX.Element {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('songs')
  const inputRef = useRef<HTMLInputElement>(null)
  const addUrl = useQueueStore((s) => s.addUrl)
  const toast = useToastStore()

  const isValidUrl = YOUTUBE_URL_PATTERNS.some((p) => p.test(url.trim()))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed || !isValidUrl || isLoading) return

    setIsLoading(true)
    try {
      await addUrl(trimmed)
      setUrl('')
      inputRef.current?.focus()
      toast.info('Added to queue')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add URL')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 0 }}>
        {(['songs', 'playlists'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-2 font-semibold transition-colors"
            style={{
              fontSize: 11.5,
              color: tab === t ? 'var(--tx)' : 'var(--tx-faint)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              textTransform: 'capitalize',
              marginBottom: -1
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={tab === 'playlists' ? 'Paste a YouTube playlist URL…' : 'Paste a YouTube URL…'}
            className="w-full px-4 py-2.5 text-sm transition-all"
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--radius)',
              color: 'var(--tx)',
              fontFamily: 'Inter, system-ui, sans-serif',
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
            autoFocus
          />
          {url.length > 0 && !isValidUrl && (
            <p className="absolute -bottom-5 left-0 text-xs" style={{ color: 'var(--bad)' }}>
              Not a valid YouTube URL
            </p>
          )}
        </div>
        <motion.button
          type="submit"
          disabled={!isValidUrl || isLoading}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 shrink-0 font-semibold transition-colors"
          style={{
            padding: '10px 20px',
            background: isValidUrl && !isLoading ? 'var(--accent)' : 'var(--bg-3)',
            color: isValidUrl && !isLoading ? '#fff' : 'var(--tx-faint)',
            borderRadius: 'var(--radius)',
            fontSize: 12.5,
            border: 'none',
            cursor: isValidUrl && !isLoading ? 'pointer' : 'not-allowed'
          }}
        >
          {isLoading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <PlusIcon className="w-4 h-4" />
          )}
          {isLoading ? 'Adding…' : 'Add to Queue'}
        </motion.button>
      </form>
    </div>
  )
}
