export type QueueStatus =
  | 'pending'
  | 'fetching'
  | 'downloading'
  | 'converting'
  | 'tagging'
  | 'completed'
  | 'paused'
  | 'cancelled'
  | 'failed'

export interface QueueItemMetadata {
  title: string
  artist: string
  album: string
  year?: number
  duration: number
  thumbnailUrl?: string
  videoId: string
}

export interface QueueItem {
  id: string
  url: string
  status: QueueStatus
  progress: number
  metadata?: QueueItemMetadata
  outputPath?: string
  error?: string
  addedAt: number
  completedAt?: number
}

export interface QueueProgressPayload {
  id: string
  progress: number
  status: QueueStatus
}

export interface QueueStatusChangedPayload {
  id: string
  status: QueueStatus
}

export interface QueueCompletedPayload {
  id: string
  outputPath: string
}

export interface QueueErrorPayload {
  id: string
  error: string
}
