import https from 'https'
import type { LNEpisode, LNPodcast, LNSearchResult } from '@shared/types/podcast'

const BASE = 'listen-api.listennotes.com'

function apiGet<T>(path: string, apiKey: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: BASE,
      path: `/api/v2${path}`,
      method: 'GET',
      headers: { 'X-ListenAPI-Key': apiKey, 'Accept': 'application/json' }
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        if (res.statusCode === 401) { reject(new Error('Invalid ListenNotes API key')); return }
        if (res.statusCode === 429) { reject(new Error('ListenNotes rate limit exceeded')); return }
        if (!res.statusCode || res.statusCode >= 400) { reject(new Error(`ListenNotes API error ${res.statusCode}`)); return }
        try { resolve(JSON.parse(data)) } catch { reject(new Error('Failed to parse ListenNotes response')) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

export function extractPodcastId(urlOrId: string): string {
  try {
    const url = new URL(urlOrId)
    const parts = url.pathname.split('/').filter(Boolean)
    return parts[parts.length - 1]
  } catch {
    return urlOrId.trim()
  }
}

export async function searchPodcasts(query: string, apiKey: string, offset = 0): Promise<LNSearchResult> {
  return apiGet<LNSearchResult>(`/search?q=${encodeURIComponent(query)}&type=podcast&offset=${offset}`, apiKey)
}

export async function searchEpisodes(query: string, apiKey: string, offset = 0): Promise<LNSearchResult> {
  return apiGet<LNSearchResult>(`/search?q=${encodeURIComponent(query)}&type=episode&offset=${offset}`, apiKey)
}

export async function getPodcast(id: string, apiKey: string, nextEpisodePubDate?: number): Promise<LNPodcast> {
  const qs = nextEpisodePubDate !== undefined ? `?next_episode_pub_date=${nextEpisodePubDate}` : ''
  return apiGet<LNPodcast>(`/podcasts/${id}${qs}`, apiKey)
}

export async function getEpisode(id: string, apiKey: string): Promise<LNEpisode> {
  return apiGet<LNEpisode>(`/episodes/${id}`, apiKey)
}
