<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onActivated } from 'vue'
import { useLibraryStore } from '../stores/libraryStore'
import { usePlayerStore } from '../stores/playerStore'
import { useViewStore } from '../stores/viewStore'
import ViewSwitcher from '../components/ViewSwitcher.vue'
import type { LibraryAlbum, LibraryArtist, LibraryTrack } from '@shared/types/library'

const lib    = useLibraryStore()
const player = usePlayerStore()
const views  = useViewStore()

// Load tracks on first mount; also re-check when navigating back via KeepAlive
onMounted(() => { if (lib.tracks.length === 0) lib.load() })
onActivated(() => { if (lib.tracks.length === 0) lib.load() })

type View = 'artists' | 'albums' | 'podcasts' | 'tracks' | 'videos'
const view       = ref<View>('albums')
const selected   = ref<LibraryAlbum | LibraryArtist | null>(null)
const searchQ    = ref('')

// ── Rename ────────────────────────────────────────────────
const renaming = ref<LibraryAlbum | null>(null)
const renameVal = ref('')
const renameError = ref('')
const renameInputEl = ref<HTMLInputElement | null>(null)

function folderPath(album: LibraryAlbum): string {
  const first = album.tracks[0]
  if (!first) return ''
  // dirname works in Node context via electron contextBridge; in renderer we compute it manually
  const sep = first.path.includes('\\') ? '\\' : '/'
  const parts = first.path.split(sep)
  parts.pop()
  return parts.join(sep)
}

async function startRename(album: LibraryAlbum, e: Event) {
  e.stopPropagation()
  renaming.value = album
  renameVal.value = album.name
  renameError.value = ''
  await nextTick()
  renameInputEl.value?.select()
}

async function commitRename(album: LibraryAlbum) {
  const name = renameVal.value.trim()
  if (!name || name === album.name) { renaming.value = null; return }
  const oldPath = folderPath(album)
  if (!oldPath) { renaming.value = null; return }
  try {
    renameError.value = ''
    await lib.renameFolder(oldPath, name)
    if (selected.value === album) {
      // Update the selected album reference name so detail panel reflects it
      album.name = name
    }
  } catch (err: any) {
    renameError.value = err.message || 'Rename failed'
    return
  }
  renaming.value = null
}

function cancelRename() {
  renaming.value = null
  renameError.value = ''
}

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
  return `nyro-file://local?p=${encodeURIComponent(path)}`
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

// ── File reveal ──────────────────────────────────────────
function revealFile(path: string) {
  window.nyro.invoke('shell:show-in-folder', path)
}

// ── Selection mode ────────────────────────────────────────
const selectionMode = ref(false)
const selectedAlbums = ref<Set<LibraryAlbum>>(new Set())
const selectedTracks = ref<Set<LibraryTrack>>(new Set())

const selectedCount = computed(() => selectedAlbums.value.size + selectedTracks.value.size)

function isAlbumSelected(album: LibraryAlbum) { return selectedAlbums.value.has(album) }
function isTrackSelected(track: LibraryTrack) { return selectedTracks.value.has(track) }

function toggleAlbum(album: LibraryAlbum) {
  const next = new Set(selectedAlbums.value)
  if (next.has(album)) next.delete(album)
  else next.add(album)
  selectedAlbums.value = next
}
function toggleTrack(track: LibraryTrack) {
  const next = new Set(selectedTracks.value)
  if (next.has(track)) next.delete(track)
  else next.add(track)
  selectedTracks.value = next
}

function clearSelection() {
  selectedAlbums.value = new Set()
  selectedTracks.value = new Set()
}

function selectAll() {
  if (view.value === 'albums') selectedAlbums.value = new Set(filteredAlbums.value)
  else if (view.value === 'podcasts') selectedAlbums.value = new Set(filteredPodcasts.value)
  else if (view.value === 'tracks') selectedTracks.value = new Set(filteredTracks.value)
  else if (view.value === 'videos') selectedTracks.value = new Set(filteredVideos.value)
}

async function deleteSelected() {
  const paths: string[] = []
  for (const album of selectedAlbums.value) paths.push(...album.tracks.map(t => t.path))
  for (const track of selectedTracks.value) paths.push(track.path)
  if (!paths.length) return
  await lib.deleteTracks(paths)
  clearSelection()
}

// ── Create folder ─────────────────────────────────────────
const showNewFolder = ref(false)
const newFolderName = ref('')
const newFolderError = ref('')
const newFolderInputEl = ref<HTMLInputElement | null>(null)

function openNewFolder() {
  newFolderName.value = ''
  newFolderError.value = ''
  showNewFolder.value = true
  nextTick(() => newFolderInputEl.value?.focus())
}

async function commitNewFolder() {
  const name = newFolderName.value.trim()
  if (!name) return
  try {
    const subfolder = view.value === 'podcasts' ? 'podcasts' : view.value === 'videos' ? 'video' : 'music'
    await window.nyro.invoke('library:create-folder', name, subfolder)
    showNewFolder.value = false
  } catch (err: any) {
    newFolderError.value = err.message || 'Failed to create folder'
  }
}

// ── Link track to folder ──────────────────────────────────
const linkError = ref('')

async function linkTrackToFolder(track: LibraryTrack) {
  linkError.value = ''
  const targetFolder = await window.nyro.invoke<string | null>('dialog:select-folder')
  if (!targetFolder) return
  try {
    await window.nyro.invoke('library:link-track', track.path, targetFolder)
    await lib.scan()
  } catch (err: any) {
    linkError.value = err.message || 'Link failed'
    setTimeout(() => { linkError.value = '' }, 3000)
  }
}

// ── Cover upload ──────────────────────────────────────────
async function pickCoverForAlbum(album: LibraryAlbum, e: Event) {
  e.stopPropagation()
  const imagePath = await window.nyro.invoke<string | null>('dialog:select-file', {
    title: 'Select Cover Image',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
  })
  if (!imagePath) return
  for (const track of album.tracks) {
    await lib.setCover(track.path, imagePath)
  }
  // Force cover path update on the album object for reactivity
  album.coverPath = album.tracks.find(t => t.coverPath)?.coverPath
}

async function pickCoverForTrack(track: LibraryTrack, e: Event) {
  e.stopPropagation()
  const imagePath = await window.nyro.invoke<string | null>('dialog:select-file', {
    title: 'Select Cover Image',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
  })
  if (!imagePath) return
  await lib.setCover(track.path, imagePath)
}
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

      <!-- Select toggle -->
      <button
        v-if="view !== 'artists'"
        class="select-btn" :class="{ active: selectionMode }"
        @click="selectionMode = !selectionMode; if (!selectionMode) clearSelection()"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        Select
      </button>

      <!-- New Folder button -->
      <button v-if="view !== 'artists'" class="new-folder-btn" title="Create new folder" @click="openNewFolder()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
        </svg>
        New Folder
      </button>

      <!-- Scan button -->
      <button class="scan-btn" :class="{ scanning: lib.scanning }" @click="lib.scan()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" :class="{ spin: lib.scanning }">
          <path d="M4 4v5h5M20 20v-5h-5"/>
          <path d="M4.07 15a8 8 0 1014.07-8.36L20 4"/>
        </svg>
        {{ lib.scanning ? 'Scanning…' : 'Scan' }}
      </button>

      <ViewSwitcher :model-value="views.library" @update:model-value="views.set('library', $event)" />
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
      <div class="list-panel" :class="{ narrow: !!selected, [`view-${views.library}`]: true }">

        <!-- Albums grid -->
        <div v-if="view === 'albums'" class="grid">
          <div
            v-for="album in filteredAlbums" :key="album.name + album.artist"
            class="card" :class="{ active: selected === album, 'sel-active': isAlbumSelected(album) }"
            @click="selectionMode ? toggleAlbum(album) : (selected = selected === album ? null : album)"
            @dblclick="!selectionMode && playAlbum(album)"
          >
            <div v-if="selectionMode" class="card-checkbox" :class="{ checked: isAlbumSelected(album) }">
              <svg v-if="isAlbumSelected(album)" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="card-art" :style="coverUrl(album.coverPath) ? { backgroundImage: `url('${coverUrl(album.coverPath)}')` } : {}">
              <svg v-if="!album.coverPath" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
                <path d="M9 18V5l12-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/>
              </svg>
              <div class="card-play-overlay">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <button class="cover-upload-btn" title="Change cover" @click.stop="pickCoverForAlbum(album, $event)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
            </div>
            <div class="card-label-row">
              <template v-if="renaming === album">
                <input
                  ref="renameInputEl"
                  v-model="renameVal"
                  class="rename-input"
                  @keydown.enter.stop="commitRename(album)"
                  @keydown.escape.stop="cancelRename"
                  @blur="commitRename(album)"
                  @click.stop
                />
                <span v-if="renameError" class="rename-error">{{ renameError }}</span>
              </template>
              <template v-else>
                <span class="card-name">{{ album.name }}</span>
                <button class="rename-btn" title="Rename folder" @click.stop="startRename(album, $event)">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </template>
            </div>
            <span class="card-sub">{{ album.artist }}{{ album.year ? ` · ${album.year}` : '' }}</span>
          </div>
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
          <div
            v-for="show in filteredPodcasts" :key="show.name"
            class="card" :class="{ active: selected === show, 'sel-active': isAlbumSelected(show) }"
            @click="selectionMode ? toggleAlbum(show) : (selected = selected === show ? null : show)"
            @dblclick="!selectionMode && playAlbum(show)"
          >
            <div v-if="selectionMode" class="card-checkbox" :class="{ checked: isAlbumSelected(show) }">
              <svg v-if="isAlbumSelected(show)" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="card-art" :style="coverUrl(show.coverPath) ? { backgroundImage: `url('${coverUrl(show.coverPath)}')` } : {}">
              <svg v-if="!show.coverPath" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                <path d="M19 10v2a7 7 0 01-14 0v-2"/>
              </svg>
              <div class="card-play-overlay">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <button class="cover-upload-btn" title="Change cover" @click.stop="pickCoverForAlbum(show, $event)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
            </div>
            <div class="card-label-row">
              <template v-if="renaming === show">
                <input
                  ref="renameInputEl"
                  v-model="renameVal"
                  class="rename-input"
                  @keydown.enter.stop="commitRename(show)"
                  @keydown.escape.stop="cancelRename"
                  @blur="commitRename(show)"
                  @click.stop
                />
                <span v-if="renameError" class="rename-error">{{ renameError }}</span>
              </template>
              <template v-else>
                <span class="card-name">{{ show.name }}</span>
                <button class="rename-btn" title="Rename folder" @click.stop="startRename(show, $event)">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </template>
            </div>
            <span class="card-sub">{{ show.tracks.length }} episodes</span>
          </div>
        </div>

        <!-- Flat track list -->
        <div v-else-if="view === 'tracks' || view === 'videos'" class="track-list">
          <div
            v-for="(track, i) in (view === 'tracks' ? filteredTracks : filteredVideos)"
            :key="track.id"
            class="track-row"
            :class="{ playing: player.currentTrack?.id === track.id, 'sel-active': isTrackSelected(track) }"
            @click="selectionMode && toggleTrack(track)"
            @dblclick="!selectionMode && playTrack(track, view === 'tracks' ? filteredTracks : filteredVideos)"
          >
            <div v-if="selectionMode" class="tr-checkbox" :class="{ checked: isTrackSelected(track) }">
              <svg v-if="isTrackSelected(track)" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span v-else class="tr-num">{{ i + 1 }}</span>
            <div class="tr-thumb" :style="coverUrl(track.coverPath) ? { backgroundImage: `url('${coverUrl(track.coverPath)}')` } : {}">
              <svg v-if="!track.coverPath" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 18V5l12-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/>
              </svg>
            </div>
            <div class="tr-info">
              <span class="tr-title">{{ track.title }}</span>
              <span class="tr-artist">{{ track.artist }}</span>
              <span class="tr-path" :title="track.path">{{ track.path }}</span>
            </div>
            <span class="tr-album">{{ track.album }}</span>
            <span class="tr-dur">{{ fmtDur(track.duration) }}</span>
            <button class="reveal-btn" title="Link to folder…" @click.stop="linkTrackToFolder(track)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
              </svg>
            </button>
            <button class="reveal-btn" title="Show in Explorer" @click.stop="revealFile(track.path)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
            </button>
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
                <div class="detail-art-overlay" @click.stop="pickCoverForAlbum(detailAlbum, $event)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span>Change cover</span>
                </div>
              </div>
              <div class="detail-meta">
                <span class="detail-label">{{ view === 'podcasts' ? 'PODCAST' : 'ALBUM' }}</span>
                <div class="detail-name-row">
                  <template v-if="renaming === detailAlbum">
                    <input
                      ref="renameInputEl"
                      v-model="renameVal"
                      class="rename-input rename-input--large"
                      @keydown.enter.stop="commitRename(detailAlbum)"
                      @keydown.escape.stop="cancelRename"
                      @blur="commitRename(detailAlbum)"
                    />
                    <span v-if="renameError" class="rename-error">{{ renameError }}</span>
                  </template>
                  <template v-else>
                    <h2 class="detail-name">{{ detailAlbum.name }}</h2>
                    <button class="rename-btn rename-btn--lg" title="Rename folder" @click.stop="startRename(detailAlbum, $event)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </template>
                </div>
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
                  <span class="tr-path" :title="track.path">{{ track.path }}</span>
                </div>
                <span class="tr-dur">{{ fmtDur(track.duration) }}</span>
                <button class="reveal-btn" title="Link to folder…" @click.stop="linkTrackToFolder(track)">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                </button>
                <button class="reveal-btn" title="Show in Explorer" @click.stop="revealFile(track.path)">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                  </svg>
                </button>
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
                    <span class="tr-path" :title="track.path">{{ track.path }}</span>
                  </div>
                  <span class="tr-dur">{{ fmtDur(track.duration) }}</span>
                  <button class="reveal-btn" title="Show in Explorer" @click.stop="revealFile(track.path)">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </template>

        </div>
      </Transition>

    </div>

    <!-- Bulk action bar -->
    <Transition name="bulk-bar">
      <div v-if="selectionMode" class="bulk-bar">
        <span class="bulk-count">{{ selectedCount }} selected</span>
        <div class="spacer" />
        <button class="bulk-btn" @click="selectAll()">Select all</button>
        <button class="bulk-btn" :disabled="!selectedCount" @click="clearSelection()">Clear</button>
        <button class="bulk-btn bulk-btn--delete" :disabled="!selectedCount" @click="deleteSelected()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          Delete
        </button>
      </div>
    </Transition>

  </div>

  <!-- ── New Folder modal ─────────────────────────────── -->
  <Transition name="modal">
    <div v-if="showNewFolder" class="modal-backdrop" @click.self="showNewFolder = false">
      <div class="modal-box">
        <h3 class="modal-title">New Folder</h3>
        <p class="modal-hint">Creates an empty folder inside your {{ view === 'podcasts' ? 'podcasts' : view === 'videos' ? 'video' : 'music' }} directory.</p>
        <input
          ref="newFolderInputEl"
          v-model="newFolderName"
          class="modal-input"
          placeholder="Folder name…"
          @keydown.enter="commitNewFolder"
          @keydown.esc="showNewFolder = false"
        />
        <p v-if="newFolderError" class="modal-error">{{ newFolderError }}</p>
        <div class="modal-actions">
          <button class="modal-cancel" @click="showNewFolder = false">Cancel</button>
          <button class="modal-confirm" :disabled="!newFolderName.trim()" @click="commitNewFolder">Create</button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- ── Link error toast ─────────────────────────────── -->
  <Transition name="toast">
    <div v-if="linkError" class="link-toast">{{ linkError }}</div>
  </Transition>

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
/* ── Select button ─────────────────────────────────── */
.select-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 0 12px; height: 30px; border-radius: 8px;
  border: 1px solid var(--line-2);
  background: var(--bg-2);
  color: var(--tx-dim); font-size: 12px; font-weight: 600;
  cursor: pointer; transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.select-btn:hover { background: var(--bg-3); color: var(--tx); }
.select-btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-glow); }

/* ── Card checkbox ─────────────────────────────────── */
.card-checkbox {
  position: absolute; top: 7px; left: 7px; z-index: 3;
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--bg-3); border: 2px solid var(--line-2);
  display: flex; align-items: center; justify-content: center;
  color: #fff; transition: background 0.12s, border-color 0.12s;
}
.card-checkbox.checked { background: var(--accent); border-color: var(--accent); }
.card.sel-active .card-art { box-shadow: 0 0 0 2px var(--accent); }

/* ── Track row checkbox ────────────────────────────── */
.tr-checkbox {
  width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
  background: var(--bg-3); border: 2px solid var(--line-2);
  display: flex; align-items: center; justify-content: center;
  color: #fff; transition: background 0.12s, border-color 0.12s;
}
.tr-checkbox.checked { background: var(--accent); border-color: var(--accent); }
.track-row.sel-active { background: var(--accent-glow); }

/* ── Bulk action bar ───────────────────────────────── */
.bulk-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 0 16px; height: 48px; flex-shrink: 0;
  background: var(--bg-1); border-top: 1px solid var(--line);
}
.bulk-count { font-size: 12px; font-weight: 600; color: var(--tx); }
.bulk-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 0 12px; height: 30px; border-radius: 7px;
  border: 1px solid var(--line-2); background: var(--bg-2);
  color: var(--tx-dim); font-size: 12px; font-weight: 600; cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.bulk-btn:hover:not(:disabled) { background: var(--bg-3); color: var(--tx); }
.bulk-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.bulk-btn--delete { border-color: rgba(191,97,106,0.4); color: var(--bad); }
.bulk-btn--delete:hover:not(:disabled) { background: rgba(191,97,106,0.15); }
.bulk-bar-enter-active, .bulk-bar-leave-active { transition: height 0.15s, opacity 0.15s; }
.bulk-bar-enter-from, .bulk-bar-leave-to { height: 0; opacity: 0; }

.lib-title { font-size: 16px; font-weight: 800; color: var(--tx); margin: 0; }
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
  border: 1px solid rgba(61,127,255,0.3);
  background: linear-gradient(135deg, rgba(61,127,255,0.12), rgba(61,127,255,0.06));
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
.view-small  .grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; }
.view-medium .grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
.view-large  .grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 18px; }
.view-xlarge .grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
/* List / Details: single column with horizontal card layout */
.view-list .grid, .view-details .grid {
  grid-template-columns: 1fr;
  gap: 2px;
}
.view-list .card, .view-details .card {
  display: flex; flex-direction: row; align-items: center; gap: 10px;
  padding: 5px 8px; border-radius: 8px; transform: none !important;
  background: transparent;
}
.view-list .card:hover, .view-details .card:hover { background: var(--bg-2); transform: none !important; }
.view-list .card-art, .view-details .card-art {
  width: 40px; height: 40px; aspect-ratio: 1; flex-shrink: 0; border-radius: 6px;
}
.view-list .card-label-row, .view-details .card-label-row {
  flex: 1; min-width: 0; flex-direction: row; align-items: center;
}
.view-list .card-name, .view-details .card-name { margin-top: 0; }
/* Track list respects list/details too — already single column, just tighten */
.view-small .track-list .track-row { padding: 4px 6px; }
.view-large .track-list .track-row, .view-xlarge .track-list .track-row { padding: 10px 12px; min-height: 52px; }
.card {
  background: none; border: none; cursor: pointer; text-align: left;
  padding: 0; border-radius: 10px; position: relative;
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

/* ── Cover upload button (card) ────────────────── */
.cover-upload-btn {
  position: absolute; bottom: 6px; right: 6px;
  width: 26px; height: 26px; border-radius: 50%;
  background: rgba(0,0,0,0.65); border: 1px solid rgba(255,255,255,0.15);
  color: #fff; display: flex; align-items: center; justify-content: center;
  cursor: pointer; opacity: 0; transition: opacity 0.15s;
  z-index: 2;
}
.card-art:hover .cover-upload-btn { opacity: 1; }
.cover-upload-btn:hover { background: rgba(61,127,255,0.4); }
.card-name { display: block; font-size: 13px; font-weight: 600; color: var(--tx); margin-top: 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-sub  { display: block; font-size: 11.5px; color: var(--tx-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

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
.artist-name { font-size: 13.5px; font-weight: 600; color: var(--tx); }
.artist-meta { font-size: 11.5px; color: var(--tx-faint); }

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
.tr-title { font-size: 13px; font-weight: 600; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-artist { font-size: 11px; color: var(--tx-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-path {
  font-size: 10px; color: var(--tx-dim); opacity: 0;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: opacity 0.12s; max-width: 100%;
}
.track-row:hover .tr-path { opacity: 0.75; }
.reveal-btn {
  flex-shrink: 0; width: 24px; height: 24px;
  background: none; border: 1px solid var(--line-2);
  border-radius: 5px; color: var(--tx-faint);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; opacity: 0; transition: opacity 0.12s, color 0.12s, background 0.12s;
}
.track-row:hover .reveal-btn { opacity: 1; }
.reveal-btn:hover { color: var(--accent); background: var(--accent-glow); border-color: var(--accent); }
.tr-album { font-size: 11.5px; color: var(--tx-faint); flex-shrink: 0; max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-dur { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--tx-faint); flex-shrink: 0; }

/* ── Detail panel ──────────────────────────────── */
.detail-panel { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.detail-header { display: flex; gap: 18px; align-items: flex-end; }
.detail-art {
  width: 110px; height: 110px; flex-shrink: 0;
  border-radius: 10px; background: var(--bg-3) center/cover no-repeat;
  display: flex; align-items: center; justify-content: center; color: var(--tx-faint);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  position: relative; overflow: hidden; cursor: pointer;
}
.detail-art-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
  background: rgba(0,0,0,0.55); opacity: 0; transition: opacity 0.15s;
  color: #fff; font-size: 10px; font-weight: 600;
}
.detail-art:hover .detail-art-overlay { opacity: 1; }
.artist-shape { border-radius: 50%; }
.detail-meta { display: flex; flex-direction: column; gap: 4px; }
.detail-label { font-size: 9.5px; font-weight: 700; color: var(--accent); letter-spacing: 0.1em; text-transform: uppercase; }
.detail-name { font-size: 21px; font-weight: 800; color: var(--tx); margin: 0; }
.detail-sub { font-size: 12.5px; color: var(--tx-faint); }
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

/* ── Card label row (name + rename pencil) ─────── */
.card-label-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 7px;
  min-width: 0;
}
.card-label-row .card-name { flex: 1; min-width: 0; margin-top: 0; }
.rename-btn {
  flex-shrink: 0;
  width: 20px; height: 20px;
  border: none; background: none;
  color: var(--tx-faint); cursor: pointer;
  border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.12s, color 0.12s, background 0.12s;
}
.card:hover .rename-btn { opacity: 1; }
.rename-btn--lg { opacity: 1; width: 28px; height: 28px; }
.rename-btn:hover { color: var(--accent); background: var(--bg-3); }

.rename-input {
  flex: 1; min-width: 0;
  background: var(--bg-3);
  border: 1px solid var(--accent);
  border-radius: 5px;
  color: var(--tx);
  font-size: 12px;
  padding: 2px 6px;
  outline: none;
  font-family: inherit;
  width: 100%;
}
.rename-input--large {
  font-size: 18px;
  font-weight: 800;
  padding: 3px 8px;
}
.rename-error {
  display: block;
  font-size: 10px;
  color: var(--bad);
  margin-top: 2px;
}

/* ── Detail name row ───────────────────────────── */
.detail-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.detail-name-row .detail-name { margin: 0; }

/* ── New Folder button ─────────────────────────── */
.new-folder-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 0 12px; height: 30px; border-radius: 8px;
  border: 1px solid var(--line-2);
  background: var(--bg-2);
  color: var(--tx-dim); font-size: 12px; font-weight: 600;
  cursor: pointer; transition: background 0.12s, color 0.12s;
}
.new-folder-btn:hover { background: var(--bg-3); color: var(--tx); }

/* ── Modal ─────────────────────────────────────── */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
}
.modal-box {
  background: var(--bg-1);
  border: 1px solid var(--line-2);
  border-radius: 12px;
  padding: 24px 28px;
  min-width: 320px; max-width: 440px; width: 100%;
  display: flex; flex-direction: column; gap: 10px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.5);
}
.modal-title { margin: 0; font-size: 16px; font-weight: 700; color: var(--tx); }
.modal-hint { margin: 0; font-size: 12px; color: var(--tx-dim); }
.modal-input {
  background: var(--bg-2); border: 1px solid var(--line-2); border-radius: 8px;
  color: var(--tx); font-size: 13px; padding: 8px 12px;
  outline: none; font-family: inherit;
}
.modal-input:focus { border-color: var(--accent); }
.modal-error { margin: 0; font-size: 11px; color: var(--bad); }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.modal-cancel {
  padding: 0 16px; height: 32px; border-radius: 8px;
  background: var(--bg-2); border: 1px solid var(--line-2);
  color: var(--tx-dim); font-size: 12px; font-weight: 600; cursor: pointer;
}
.modal-cancel:hover { background: var(--bg-3); color: var(--tx); }
.modal-confirm {
  padding: 0 16px; height: 32px; border-radius: 8px;
  background: var(--accent); border: none;
  color: var(--bg-0); font-size: 12px; font-weight: 700; cursor: pointer;
}
.modal-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
.modal-confirm:not(:disabled):hover { filter: brightness(1.1); }

/* ── Link error toast ──────────────────────────── */
.link-toast {
  position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
  background: var(--bad); color: #fff; font-size: 12px; font-weight: 600;
  padding: 8px 18px; border-radius: 20px; z-index: 300;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}

/* ── Modal / toast transitions ─────────────────── */
.modal-enter-active, .modal-leave-active { transition: opacity 0.18s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }
</style>
