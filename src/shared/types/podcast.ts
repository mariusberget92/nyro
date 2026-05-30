export interface LNEpisode {
  id: string
  title: string
  audio: string
  audio_length_sec: number
  pub_date_ms: number
  description: string
  image: string
  podcast: { id: string; title: string; publisher: string }
}

export interface LNPodcast {
  id: string
  title: string
  publisher: string
  image: string
  description: string
  total_episodes: number
  episodes: LNEpisode[]
  next_episode_pub_date: number | null
}

export interface LNSearchResult {
  results: Array<{
    id: string
    title_original: string
    publisher_original: string
    image: string
    description_original: string
    total_episodes?: number
    audio?: string
    audio_length_sec?: number
    pub_date_ms?: number
    podcast?: { id: string; title_original: string; publisher_original: string }
  }>
  next_offset: number
  total: number
}
