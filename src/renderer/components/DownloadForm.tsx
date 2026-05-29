import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { useQueueStore } from '../stores/queueStore'
import { useToastStore } from '../stores/toastStore'
import { YOUTUBE_URL_PATTERNS } from '@shared/constants'

export function DownloadForm(): JSX.Element {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const addUrl = useQueueStore((s) => s.addUrl)
  const startQueue = useQueueStore((s) => s.startQueue)
  const toast = useToastStore()

  const isValidUrl = YOUTUBE_URL_PATTERNS.some((p) => p.test(url.trim()))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed || !isValidUrl || isLoading) return

    setIsLoading(true)
    try {
      await addUrl(trimmed)
      await startQueue()
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
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube URL or playlist link…"
          className="w-full px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-nyro-500 focus:border-transparent transition-colors"
          autoFocus
        />
        {url.length > 0 && !isValidUrl && (
          <p className="absolute -bottom-5 left-0 text-xs text-red-400">
            Not a valid YouTube URL
          </p>
        )}
      </div>
      <motion.button
        type="submit"
        disabled={!isValidUrl || isLoading}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2 px-4 py-2.5 bg-nyro-600 hover:bg-nyro-500 disabled:bg-surface-700 disabled:text-surface-500 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
      >
        {isLoading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <ArrowDownTrayIcon className="w-4 h-4" />
        )}
        {isLoading ? 'Adding…' : 'Download'}
      </motion.button>
    </form>
  )
}
