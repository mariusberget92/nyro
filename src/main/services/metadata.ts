import NodeID3 from 'node-id3'

export interface TrackMetadata {
  title: string
  artist: string
  album: string
  lyrics?: string
  trackNumber?: string
  year?: string
}

/**
 * Write ID3 tags to an MP3 file.
 * Uses node-id3 to embed: Title, Artist, Album, UnsynchronisedLyrics.
 */
export async function writeID3Tags(filePath: string, meta: TrackMetadata): Promise<void> {
  const tags: NodeID3.Tags = {
    title: meta.title,
    artist: meta.artist,
    album: meta.album
  }

  if (meta.trackNumber) {
    tags.trackNumber = meta.trackNumber
  }

  if (meta.year) {
    tags.year = meta.year
  }

  if (meta.lyrics) {
    tags.unsynchronisedLyrics = {
      language: 'eng',
      text: meta.lyrics
    }
  }

  const result = NodeID3.write(tags, filePath)

  if (result instanceof Error) {
    throw result
  }
}
