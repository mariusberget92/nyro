import { WINDOWS_INVALID_CHARS } from '@shared/constants'
import type { AppSettings } from '@shared/types/settings'

/**
 * Sanitize a string for use as a filename component.
 * Strips characters invalid on Windows filesystems.
 */
export function sanitizeFilenameComponent(input: string): string {
  return input
    .replace(WINDOWS_INVALID_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200)
}

export interface FilenameOptions {
  title: string
  artist: string
  settings: AppSettings
  index?: number
  total?: number
}

/**
 * Build the final filename (without extension) for a downloaded track.
 */
export function buildFilename(opts: FilenameOptions): string {
  const { title, artist, settings, index, total } = opts

  const safeTitle = sanitizeFilenameComponent(title)
  const safeArtist = sanitizeFilenameComponent(artist)

  let base: string

  switch (settings.filenameFormat) {
    case 'title-artist':
      base = `${safeTitle} - ${safeArtist}`
      break
    case 'title':
      base = safeTitle
      break
    case 'artist-title':
    default:
      base = `${safeArtist} - ${safeTitle}`
      break
  }

  if (settings.numericPrefix && index !== undefined && total !== undefined) {
    const padLength = String(total).length
    const prefix = String(index).padStart(padLength, '0')
    base = `${prefix} - ${base}`
  }

  return base
}
