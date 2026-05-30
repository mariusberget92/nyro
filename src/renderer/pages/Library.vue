<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLibraryStore } from '../stores/libraryStore'
import { usePlayerStore } from '../stores/playerStore'
import type { LibraryAlbum, LibraryArtist, LibraryTrack } from '@shared/types/library'

const lib   = useLibraryStore()
const player = usePlayerStore()

type View = 'artists' | 'albums' | 'podcasts' | 'tracks' | 'videos'
const view       = ref<View>('albums')
const selected   = ref<LibraryAlbum | LibraryArtist | null>(null)
const searchQ    = ref('')

const filteredAlbums = computed(() =>
  lib.albums.filter(a =>
    !searchQ.value ||
    a.name.toLowerCase().includes(searchQ.value.toLowerCase()) ||
    a.artist.toLowerCase().includes(searchQ.value.toLowerCase())
  )
)
const filteredArtists = computed(() =>
  lib.artists.filter(a =>
    !searchQ.value || a.name.toLowerCase().includes(searchQ.value.toLowerCase())
  )
)
const filteredPodcasts = computed(() =>
  lib.podcasts.filter(p =>
    !searchQ.value || p.name.toLowerCase().includes(searchQ.value.toLowerCase())
  )
)
const filteredTracks = computed(() =>
  lib.musicTracks.filter(t =>
    !searchQ.value ||
    t.title.toLowerCase().includes(searchQ.value.toLowerCase()) ||
    t.artist.toLowerCase().includes(searchQ.value.toLowerCase())
  )
)
const filteredVideos = computed(() =>
  lib.videoTracks.filter(t =>
    !searchQ.value || t.title.toLowerCase().includes(searchQ.value.toLowerCase())
  )
)

function coverUrl(path?: string) {
  if (!path) return null
  return `nyro-file://${encodeURIComponent(path.replace(/\\/g, '/'))}`
}

function playAlbum(album: LibraryAlbum, startIdx = 0) {
  player.play(album.tracks, startIdx)
}

function playArtist(artist: LibraryArtist, startIdx = 0) {
  player.play(artist.tracks, startIdx)
}

function playTrack(track: LibraryTrack, allTracks: LibraryTrack[]) {
  const idx = allTracks.indexOf(track)
  player.play(allTracks, Math.max(0, idx))
}

function fmtDur(sec?: number) {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const detailAlbum = computed((): LibraryAlbum | null => {
  if (!selected.value || view.value === 'artists') return null
  return selected.value as LibraryAlbum
})
const detailArtist = computed((): LibraryArtist | null => {
  if (!selected.value || view.value !== 'artists') return null
  return selected.value as LibraryArtist
})
</script>

<template>
  <div class="library">

    <!-- Header -->
    <header class="lib-header">
      <h1 class="lib-title">Library</h1>
      <span class="lib-count">{{ lib.tracks.length }} tracks</span>
      <div class="spacer" />

      <!-- Search -->
      <div class="search-wrap">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input v-model="searchQ" class="search-input" placeholder="Search…" />
      </div>

      <!-- Scan button -->
      <button class="scan-btn" :class="{ scanning: lib.scanning }" @click="lib.scan()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" :class="{ spin: lib.scanning }">
          <path d="M4 4v5h5M20 20v-5h-5"/>
          <path d="M4.07 15a8 8 0 1014.07-8.36L20 4"/>
        </svg>
        {{ lib.scanning ? 'Scanning…' : 'Scan' }}
      </button>
    </header>

    <!-- Tab bar -->
    <div class="tab-bar">
      <button v-for="t in (['albums','artists','podcasts','tracks','videos'] as View[])"
        :key="t" class="tab" :class="{ active: view === t }"
        @click="view = t; selected = null; searchQ = ''"
      >{{ t }}</button>
    </div>

    <!-- Empty state -->
    <div v-if="lib.tracks.length === 0 && !lib.scanning" class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
      <p>No tracks yet. Click <strong>Scan</strong> to index your output folder.</p>
    </div>

    <div v-else class="lib-body">

      <!-- ── LIST panel ─────────────────────────────── -->
      <div class="list-panel" :class="{ narrow: !!selected }">

        <!-- Albums grid -->
        <div v-if="view === 'albums'" class="grid">
          <button
            v-for="album in filteredAlbums" :key="album.name + album.artist"
            class="card" :class="{ active: selected === album }"
            @click="selected = selected === album ? null : album"
            @dblclick="playAlbum(album)"
          >
            <div class="card-art" :style="coverUrl(album.coverPath) ? { backgroundImage: `url('${coverUrl(album.coverPath)}')` } : {}">
              <svg v-if="!album.coverPath" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
                <path d="M9 18V5l12-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/>
              </svg>
              <div class="card-play-overlay">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
            </div>
            <span class="card-name">{{ album.name }}</span>
            <span class="card-sub">{{ album.artist }}{{ album.year ? ` · ${album.year}` : '' }}</span>
          </button>
        </div>

        <!-- Artists list -->
        <div v-else-if="view === 'artists'" class="artist-list">
          <button
            v-for="artist in filteredArtists" :key="artist.name"
            class="artist-row" :class="{ active: selected === artist }"
            @click="selected = selected === artist ? null : artist"
            @dblclick="playArtist(artist)"
          >
            <div class="artist-avatar" :style="coverUrl(artist.coverPath) ? { backgroundImage: `url('${coverUrl(artist.coverPath)}')` } : {}">
              <svg v-if="!artist.coverPath" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div class="artist-info">
              <span class="artist-name">{{ artist.name }}</span>
              <span class="artist-meta">{{ artist.albums.length }} album{{ artist.albums.length !== 1 ? 's' : '' }} · {{ artist.tracks.length }} tracks</span>
            </div>
          </button>
        </div>

        <!-- Podcasts grid -->
        <div v-else-if="view === 'podcasts'" class="grid">
          <button
            v-for="show in filteredPodcasts" :key="show.name"
            class="card" :class="{ active: selected === show }"
            @click="selected = selected === show ? null : show"
            @dblclick="playAlbum(show)"
          >
            <div class="card-art" :style="coverUrl(show.coverPath) ? { backgroundImage: `url('${coverUrl(show.coverPath)}')` } : {}">
              <svg v-if="!show.coverPath" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                <path d="M19 10v2a7 7 0 01-14 0v-2"/>
              </svg>
              <div class="card-play-overlay">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
            </div>
            <span class="card-name">{{ show.name }}</span>
            <span class="card-sub">{{ show.tracks.length }} episodes</span>
          </button>
        </div>

        <!-- Flat track list -->
        <div v-else-if="view === 'tracks' || view === 'videos'" class="track-list">
          <div
            v-for="(track, i) in (view === 'tracks' ? filteredTracks : filteredVideos)"
            :key="track.id"
            class="track-row"
            :class="{ playing: player.currentTrack?.id === track.id }"
            @dblclick="playTrack(track, view === 'tracks' ? filteredTracks : filteredVideos)"
          >
            <span class="tr-num">{{ i + 1 }}</span>
            <div class="tr-thumb" :style="coverUrl(track.coverPath) ? { backgroundImage: `url('${coverUrl(track.coverPath)}')` } : {}">
              <svg v-if="!track.coverPath" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 18V5l12-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/>
              </svg>
            </div>
            <div class="tr-info">
              <span class="tr-title">{{ track.title }}</span>
              <span class="tr-artist">{{ track.artist }}</span>
            </div>
            <span class="tr-album">{{ track.album }}</span>
            <span class="tr-dur">{{ fmtDur(track.duration) }}</span>
          </div>
        </div>

      </div>

      <!-- ── DETAIL panel ────────────────────────────── -->
      <Transition name="detail">
        <div v-if="selected" class="detail-panel">

          <!-- Album / Podcast detail -->
          <template v-if="detailAlbum">
            <div class="detail-header">
              <div class="detail-art" :style="coverUrl(detailAlbum.coverPath) ? { backgroundImage: `url('${coverUrl(detailAlbum.coverPath)}')` } : {}">
                <svg v-if="!detailAlbum.coverPath" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                  <path d="M9 18V5l12-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/>
                </svg>
              </div>
              <div class="detail-meta">
                <span class="detail-label">{{ view === 'podcasts' ? 'PODCAST' : 'ALBUM' }}</span>
                <h2 class="detail-name">{{ detailAlbum.name }}</h2>
                <span class="detail-sub">{{ detailAlbum.artist }}{{ detailAlbum.year ? ` · ${detailAlbum.year}` : '' }}</span>
                <span class="detail-sub">{{ detailAlbum.tracks.length }} tracks</span>
                <button class="play-all-btn" @click="playAlbum(detailAlbum)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Play all
                </button>
              </div>
            </div>

            <div class="detail-tracks">
              <div
                v-for="(track, i) in detailAlbum.tracks" :key="track.id"
                class="track-row"
                :class="{ playing: player.currentTrack?.id === track.id }"
                @dblclick="playAlbum(detailAlbum, i)"
              >
                <span class="tr-num">{{ track.trackNumber ?? i + 1 }}</span>
                <div class="tr-info">
                  <span class="tr-title">{{ track.title }}</span>
                  <span class="tr-artist">{{ track.artist }}</span>
                </div>
                <span class="tr-dur">{{ fmtDur(track.duration) }}</span>
              </div>
            </div>
          </template>

          <!-- Artist detail -->
          <template v-else-if="detailArtist">
            <div class="detail-header">
              <div class="detail-art artist-shape" :style="coverUrl(detailArtist.coverPath) ? { backgroundImage: `url('${coverUrl(detailArtist.coverPath)}')` } : {}">
                <svg v-if="!detailArtist.coverPath" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div class="detail-meta">
                <span class="detail-label">ARTIST</span>
                <h2 class="detail-name">{{ detailArtist.name }}</h2>
                <span class="detail-sub">{{ detailArtist.albums.length }} albums · {{ detailArtist.tracks.length }} tracks</span>
                <button class="play-all-btn" @click="playArtist(detailArtist)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Play all
                </button>
              </div>
            </div>

            <div v-for="album in detailArtist.albums" :key="album.name" class="artist-album-section">
              <div class="album-section-header">
                <span class="album-section-name">{{ album.name }}</span>
                <span class="album-section-year">{{ album.year }}</span>
              </div>
              <div class="detail-tracks">
                <div
                  v-for="(track, i) in album.tracks" :key="track.id"
                  class="track-row"
                  :class="{ playing: player.currentTrack?.id === track.id }"
                  @dblclick="playAlbum(album, i)"
                >
                  <span class="tr-num">{{ track.trackNumber ?? i + 1 }}</span>
                  <div class="tr-info">
                    <span class="tr-title">{{ track.title }}</span>
                  </div>
                  <span class="tr-dur">{{ fmtDur(track.duration) }}</span>
                </div>
              </div>
            </div>
          </template>

        </div>
      </Transition>

    </div>

  </div>
</template>

<style scoped>
.library { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

/* ── Header ────────────────────────────────────── */
.lib-header {
  height: 52px; padding: 0 16px;
  display: flex; align-items: center; gap: 10px;
  background: linear-gradient(to bottom, var(--bg-1), var(--bg-0));
  border-bottom: 1px solid var(--line); flex-shrink: 0;
}
.lib-title { font-size: 15px; font-weight: 800; color: var(--tx); margin: 0; }
.lib-count { font-size: 10.5px; color: var(--tx-faint); background: var(--bg-2); padding: 2px 7px; border-radius: 20px; }
.spacer { flex: 1; }
.search-wrap {
  display: flex; align-items: center; gap: 7px;
  background: var(--bg-2); border: 1px solid var(--line-2);
  border-radius: 8px; padding: 0 10px; height: 30px; color: var(--tx-faint);
}
.search-input {
  background: none; border: none; outline: none;
  color: var(--tx); font-size: 12px; width: 140px;
}
.search-input::placeholder { color: var(--tx-faint); }
.scan-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 0 12px; height: 30px; border-radius: 8px;
  border: 1px solid rgba(136,192,208,0.3);
  background: linear-gradient(135deg, rgba(136,192,208,0.12), rgba(136,192,208,0.06));
  color: var(--accent); font-size: 12px; font-weight: 600;
  font-family: 'JetBrains Mono', monospace; cursor: pointer;
  transition: box-shadow 0.15s;
}
.scan-btn:hover { box-shadow: 0 0 10px var(--accent-glow); }
.scan-btn.scanning { opacity: 0.6; cursor: wait; }
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }

/* ── Tab bar ───────────────────────────────────── */
.tab-bar {
  display: flex; gap: 0; padding: 0 16px;
  background: var(--bg-0); border-bottom: 1px solid var(--line); flex-shrink: 0;
}
.tab {
  padding: 8px 14px; border: none; background: none;
  color: var(--tx-faint); font-size: 12px; font-weight: 600;
  text-transform: capitalize; letter-spacing: 0.03em; cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: color 0.12s, border-color 0.12s;
}
.tab:hover { color: var(--tx-dim); }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }

/* ── Empty ─────────────────────────────────────── */
.empty-state {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 14px;
  color: var(--tx-faint);
}
.empty-state p { font-size: 13px; text-align: center; }
.empty-state strong { color: var(--accent); }

/* ── Body split ────────────────────────────────── */
.lib-body { flex: 1; display: flex; overflow: hidden; }
.list-panel { flex: 1; overflow-y: auto; padding: 16px; transition: flex 0.2s; }
.list-panel.narrow { flex: 0 0 340px; border-right: 1px solid var(--line); }

/* ── Album / Podcast grid ──────────────────────── */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 14px;
}
.card {
  background: none; border: none; cursor: pointer; text-align: left;
  padding: 0; border-radius: 10px;
  transition: transform 0.12s;
}
.card:hover { transform: translateY(-2px); }
.card.active .card-art { box-shadow: 0 0 0 2px var(--accent); }
.card-art {
  width: 100%; aspect-ratio: 1;
  border-radius: 8px; background: var(--bg-3) center/cover no-repeat;
  display: flex; align-items: center; justify-content: center;
  color: var(--tx-faint); position: relative; overflow: hidden;
}
.card-play-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.45); opacity: 0; transition: opacity 0.15s;
  color: #fff;
}
.card-art:hover .card-play-overlay { opacity: 1; }
.card-name { display: block; font-size: 12.5px; font-weight: 600; color: var(--tx); margin-top: 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-sub  { display: block; font-size: 11px; color: var(--tx-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── Artist list ───────────────────────────────── */
.artist-list { display: flex; flex-direction: column; gap: 2px; }
.artist-row {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 10px; border-radius: 8px; border: none; background: none;
  cursor: pointer; text-align: left; width: 100%;
  transition: background 0.12s;
}
.artist-row:hover { background: var(--bg-2); }
.artist-row.active { background: var(--accent-glow); }
.artist-avatar {
  width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
  background: var(--bg-3) center/cover no-repeat;
  display: flex; align-items: center; justify-content: center; color: var(--tx-faint);
}
.artist-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.artist-name { font-size: 13px; font-weight: 600; color: var(--tx); }
.artist-meta { font-size: 11px; color: var(--tx-faint); }

/* ── Flat track list ───────────────────────────── */
.track-list { display: flex; flex-direction: column; }

/* ── Track row (shared) ────────────────────────── */
.track-row {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 8px; border-radius: 6px; cursor: pointer;
  transition: background 0.1s;
}
.track-row:hover { background: var(--bg-2); }
.track-row.playing { background: var(--accent-glow); }
.track-row.playing .tr-title { color: var(--accent); }
.tr-num { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--tx-faint); width: 20px; text-align: right; flex-shrink: 0; }
.tr-thumb {
  width: 32px; height: 32px; border-radius: 4px; flex-shrink: 0;
  background: var(--bg-3) center/cover no-repeat;
  display: flex; align-items: center; justify-content: center; color: var(--tx-faint);
}
.tr-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.tr-title { font-size: 12.5px; font-weight: 600; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-artist { font-size: 10.5px; color: var(--tx-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-album { font-size: 11px; color: var(--tx-faint); flex-shrink: 0; max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-dur { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--tx-faint); flex-shrink: 0; }

/* ── Detail panel ──────────────────────────────── */
.detail-panel { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.detail-header { display: flex; gap: 18px; align-items: flex-end; }
.detail-art {
  width: 110px; height: 110px; flex-shrink: 0;
  border-radius: 10px; background: var(--bg-3) center/cover no-repeat;
  display: flex; align-items: center; justify-content: center; color: var(--tx-faint);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.artist-shape { border-radius: 50%; }
.detail-meta { display: flex; flex-direction: column; gap: 4px; }
.detail-label { font-size: 9.5px; font-weight: 700; color: var(--accent); letter-spacing: 0.1em; text-transform: uppercase; }
.detail-name { font-size: 20px; font-weight: 800; color: var(--tx); margin: 0; }
.detail-sub { font-size: 12px; color: var(--tx-faint); }
.play-all-btn {
  margin-top: 6px; display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 20px;
  background: var(--accent); color: var(--bg-0);
  border: none; font-size: 12px; font-weight: 700; cursor: pointer;
  width: fit-content;
  transition: box-shadow 0.15s;
}
.play-all-btn:hover { box-shadow: 0 0 14px var(--accent-glow-strong); }
.detail-tracks { display: flex; flex-direction: column; gap: 1px; }

.artist-album-section { display: flex; flex-direction: column; gap: 6px; }
.album-section-header { display: flex; align-items: baseline; gap: 10px; padding: 4px 8px; }
.album-section-name { font-size: 13px; font-weight: 700; color: var(--tx-dim); }
.album-section-year { font-size: 11px; color: var(--tx-faint); }

/* ── Detail transition ─────────────────────────── */
.detail-enter-active, .detail-leave-active { transition: opacity 0.15s, transform 0.15s; }
.detail-enter-from, .detail-leave-to { opacity: 0; transform: translateX(12px); }
</style>
