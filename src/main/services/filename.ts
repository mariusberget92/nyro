import { WINDOWS_INVALID_CHARS } from '@shared/constants'
import type { AppSettings } from '@shared/types/settings'

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
}

/**
 * Resolve a prefix template into a string.
 * {0} → 1-digit, {00} → 2-digit, {000} → 3-digit, etc.
 * Example: "{000} - " with index 5 → "005 - "
 * Example: "EP{00} · " with index 12 → "EP12 · "
 */
export function resolvePrefixTemplate(template: string, index: number): string {
  return template.replace(/\{(0+)\}/g, (_match, zeros: string) =>
    String(index).padStart(zeros.length, '0')
  )
}

export function buildFilename(opts: FilenameOptions): string {
  const { title, artist, settings, index } = opts

  const safeTitle = sanitizeFilenameComponent(title)
  const safeArtist = sanitizeFilenameComponent(artist)

  let base: string
  switch (settings.filenameFormat) {
    case 'title-artist': base = `${safeTitle} - ${safeArtist}`; break
    case 'title':        base = safeTitle; break
    case 'artist-title':
    default:             base = `${safeArtist} - ${safeTitle}`; break
  }

  if (settings.numericPrefix && index !== undefined) {
    const template = settings.prefixTemplate || '{000} - '
    const resolved = resolvePrefixTemplate(template, index)
    base = `${resolved}${base}`
  }

  return base
}
