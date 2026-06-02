import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync } from 'fs'

export type TrackRow = {
  id: string
  path: string
  title: string
  artist: string
  album: string
  year: number | null
  track_number: number | null
  genre: string | null
  lrc_path: string | null
  source: string
  scanned_at: number
  has_thumbnail: number
}

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  // Lazy — safe because IPC handlers only run after app.whenReady()
  const { app } = require('electron') as typeof import('electron')
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  _db = new Database(join(dir, 'library.db'))
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = OFF')
  _db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id           TEXT PRIMARY KEY,
      path         TEXT NOT NULL,
      title        TEXT NOT NULL,
      artist       TEXT NOT NULL,
      album        TEXT NOT NULL,
      year         INTEGER,
      track_number INTEGER,
      genre        TEXT,
      lrc_path     TEXT,
      source       TEXT NOT NULL DEFAULT 'music',
      scanned_at   INTEGER NOT NULL DEFAULT 0,
      mtime        INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_path ON tracks(path);

    CREATE TABLE IF NOT EXISTS thumbnails (
      track_id TEXT PRIMARY KEY,
      data     BLOB NOT NULL,
      mime     TEXT NOT NULL DEFAULT 'image/jpeg'
    );
  `)
  // Migration: add mtime column to databases created before this version
  try { _db.exec('ALTER TABLE tracks ADD COLUMN mtime INTEGER NOT NULL DEFAULT 0') } catch {}
  return _db
}

export function upsertTracksAndThumbs(
  db: Database.Database,
  items: Array<{
    id: string; path: string; title: string; artist: string; album: string
    year?: number; trackNumber?: number; genre?: string; lrcPath?: string
    source: string; scannedAt: number; mtime?: number
    thumbData?: Buffer; thumbMime?: string
  }>
): void {
  const insertTrack = db.prepare(`
    INSERT INTO tracks (id, path, title, artist, album, year, track_number, genre, lrc_path, source, scanned_at, mtime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      path = excluded.path, title = excluded.title, artist = excluded.artist,
      album = excluded.album, year = excluded.year, track_number = excluded.track_number,
      genre = excluded.genre, lrc_path = excluded.lrc_path, source = excluded.source,
      scanned_at = excluded.scanned_at, mtime = excluded.mtime
  `)
  const insertThumb = db.prepare(`
    INSERT INTO thumbnails (track_id, data, mime) VALUES (?, ?, ?)
    ON CONFLICT(track_id) DO UPDATE SET data = excluded.data, mime = excluded.mime
  `)
  db.transaction(() => {
    for (const it of items) {
      insertTrack.run(it.id, it.path, it.title, it.artist, it.album,
        it.year ?? null, it.trackNumber ?? null, it.genre ?? null,
        it.lrcPath ?? null, it.source, it.scannedAt, it.mtime ?? 0)
      if (it.thumbData) insertThumb.run(it.id, it.thumbData, it.thumbMime ?? 'image/jpeg')
    }
  })()
}

export function setThumbnail(db: Database.Database, trackId: string, data: Buffer, mime = 'image/jpeg'): void {
  db.prepare(`
    INSERT INTO thumbnails (track_id, data, mime) VALUES (?, ?, ?)
    ON CONFLICT(track_id) DO UPDATE SET data = excluded.data, mime = excluded.mime
  `).run(trackId, data, mime)
}

export function getThumbnail(db: Database.Database, trackId: string): { data: Buffer; mime: string } | null {
  return (db.prepare('SELECT data, mime FROM thumbnails WHERE track_id = ?').get(trackId) as any) ?? null
}

export function getAllTracks(db: Database.Database): TrackRow[] {
  return db.prepare(`
    SELECT t.*,
      CASE WHEN th.track_id IS NOT NULL THEN 1 ELSE 0 END AS has_thumbnail
    FROM tracks t
    LEFT JOIN thumbnails th ON th.track_id = t.id
  `).all() as TrackRow[]
}

export function updateTracksInFolder(
  db: Database.Database,
  oldFolder: string,
  newFolder: string,
  newAlbum: string
): void {
  const rows = db.prepare(`
    SELECT id, path FROM tracks WHERE path LIKE ? OR path LIKE ?
  `).all(oldFolder + '/%', oldFolder + '\\%') as { id: string; path: string }[]
  if (!rows.length) return
  const update = db.prepare('UPDATE tracks SET path = ?, album = ? WHERE id = ?')
  db.transaction(() => {
    for (const row of rows) {
      update.run(newFolder + row.path.slice(oldFolder.length), newAlbum, row.id)
    }
  })()
}

export function deleteTrackByPath(db: Database.Database, path: string): void {
  const row = db.prepare('SELECT id FROM tracks WHERE path = ?').get(path) as { id: string } | undefined
  if (row) {
    db.prepare('DELETE FROM thumbnails WHERE track_id = ?').run(row.id)
    db.prepare('DELETE FROM tracks WHERE id = ?').run(row.id)
  }
}

export function hasTracks(db: Database.Database): boolean {
  const row = db.prepare('SELECT 1 FROM tracks LIMIT 1').get()
  return !!row
}

// Returns a map of path → mtime for all tracked files (used by incremental scan)
export function getStoredMtimes(db: Database.Database): Map<string, number> {
  const rows = db.prepare('SELECT path, mtime FROM tracks').all() as { path: string; mtime: number }[]
  return new Map(rows.map(r => [r.path, r.mtime]))
}

// Remove DB records for files that no longer exist on disk
export function pruneDeletedTracks(db: Database.Database, existingPaths: Set<string>): void {
  const rows = db.prepare('SELECT id, path FROM tracks').all() as { id: string; path: string }[]
  const toDelete = rows.filter(r => !existingPaths.has(r.path))
  if (!toDelete.length) return
  const delTrack = db.prepare('DELETE FROM tracks WHERE id = ?')
  const delThumb = db.prepare('DELETE FROM thumbnails WHERE track_id = ?')
  db.transaction(() => {
    for (const r of toDelete) { delTrack.run(r.id); delThumb.run(r.id) }
  })()
}
