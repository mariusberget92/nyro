import https from 'https'
import type { TaddyEpisode, TaddySeries, TaddySearchResult } from '@shared/types/podcast'

const ENDPOINT = 'api.taddy.org'

// In-memory cache — conserves the 300 req/month limit
const cache = new Map<string, { ts: number; data: unknown }>()
const CACHE_TTL = 1000 * 60 * 60 * 6 // 6 hours

function fromCache<T>(key: string): T | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.ts > CACHE_TTL) { cache.delete(key); return null }
  return hit.data as T
}

function toCache(key: string, data: unknown) {
  cache.set(key, { ts: Date.now(), data })
}

function gql(userId: string, apiKey: string, query: string): Promise<unknown> {
  const cacheKey = `${userId}:${query}`
  const cached = fromCache<unknown>(cacheKey)
  if (cached) return Promise.resolve(cached)

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query })
    const req = https.request({
      hostname: ENDPOINT,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-USER-ID': userId,
        'X-API-KEY': apiKey,
      }
    }, (res) => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => {
        try {
          const json = JSON.parse(raw)
          if (json.errors?.length) {
            const code = json.errors[0]?.extensions?.code
            if (code === 'API_RATE_LIMIT_EXCEEDED') reject(new Error('Taddy rate limit reached (300 req/month)'))
            else if (code === 'API_KEY_INVALID') reject(new Error('Invalid Taddy credentials'))
            else reject(new Error(json.errors[0]?.message || 'Taddy API error'))
            return
          }
          toCache(cacheKey, json.data)
          resolve(json.data)
        } catch {
          reject(new Error('Failed to parse Taddy response'))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── Helpers ──────────────────────────────────────────────

function mapEpisode(e: any): TaddyEpisode {
  return {
    uuid: e.uuid,
    name: e.name,
    description: e.description ?? '',
    audioUrl: e.audioUrl ?? '',
    imageUrl: e.imageUrl ?? undefined,
    duration: e.duration ?? undefined,
    datePublished: e.datePublished ?? undefined,
    episodeNumber: e.episodeNumber ?? undefined,
    seasonNumber: e.seasonNumber ?? undefined,
  }
}

function mapSeries(s: any, episodes: any[], page: number, hasMore: boolean): TaddySeries {
  return {
    uuid: s.uuid,
    name: s.name,
    authorName: s.authorName ?? undefined,
    description: s.description ?? undefined,
    imageUrl: s.imageUrl ?? undefined,
    totalEpisodesCount: s.totalEpisodesCount ?? undefined,
    rssUrl: s.rssUrl ?? undefined,
    episodes: (episodes ?? []).map(mapEpisode),
    page,
    hasMore,
  }
}

// ── Public API ───────────────────────────────────────────

const SERIES_FIELDS = `uuid name authorName description imageUrl totalEpisodesCount rssUrl`
const EPISODE_FIELDS = `uuid name description audioUrl imageUrl duration datePublished episodeNumber seasonNumber`

export async function searchPodcasts(
  query: string, userId: string, apiKey: string
): Promise<TaddySearchResult> {
  const q = `{ search(term: ${JSON.stringify(query)}, filterForTypes: PODCASTSERIES, limitPerPage: 10) {
    podcastSeries { ${SERIES_FIELDS} }
  } }`
  const data: any = await gql(userId, apiKey, q)
  return {
    series: (data?.search?.podcastSeries ?? []).map((s: any) => ({
      uuid: s.uuid,
      name: s.name,
      authorName: s.authorName,
      description: s.description,
      imageUrl: s.imageUrl,
      totalEpisodesCount: s.totalEpisodesCount,
    }))
  }
}

export async function getPodcastSeries(
  uuid: string, userId: string, apiKey: string, page = 1
): Promise<TaddySeries> {
  const limit = 25
  const q = `{ getPodcastSeries(uuid: "${uuid}") {
    ${SERIES_FIELDS}
    episodes(page: ${page}, limitPerPage: ${limit}, sortOrder: LATEST) { ${EPISODE_FIELDS} }
  } }`
  const data: any = await gql(userId, apiKey, q)
  const s = data?.getPodcastSeries
  if (!s) throw new Error('Podcast not found')
  const episodes: any[] = s.episodes ?? []
  return mapSeries(s, episodes, page, episodes.length === limit)
}

export async function getEpisode(
  uuid: string, userId: string, apiKey: string
): Promise<TaddyEpisode> {
  const q = `{ getPodcastEpisode(uuid: "${uuid}") { ${EPISODE_FIELDS} } }`
  const data: any = await gql(userId, apiKey, q)
  const e = data?.getPodcastEpisode
  if (!e) throw new Error('Episode not found')
  return mapEpisode(e)
}
