// Taddy GraphQL API types

export interface TaddyEpisode {
  uuid: string
  name: string
  description: string
  audioUrl: string
  imageUrl?: string
  duration?: number        // seconds
  datePublished?: number   // epoch seconds
  episodeNumber?: number
  seasonNumber?: number
}

export interface TaddySeries {
  uuid: string
  name: string
  authorName?: string
  description?: string
  imageUrl?: string
  totalEpisodesCount?: number
  rssUrl?: string
  episodes: TaddyEpisode[]
  // pagination
  page: number
  hasMore: boolean
}

export interface TaddySearchResult {
  series: Array<{
    uuid: string
    name: string
    authorName?: string
    description?: string
    imageUrl?: string
    totalEpisodesCount?: number
  }>
}
