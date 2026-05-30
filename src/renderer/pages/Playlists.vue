<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePlaylistStore, type CustomPlaylist } from '../stores/playlistStore'
import { useLibraryStore } from '../stores/libraryStore'
import { usePlayerStore } from '../stores/playerStore'
import type { LibraryTrack } from '@shared/types/library'

const plStore  = usePlaylistStore()
const lib      = useLibraryStore()
const player   = usePlayerStore()

// ── View state ─────────────────────────────────────────
const selected   = ref<CustomPlaylist | null>(null)
const showCreate = ref(false)
const editingPl  = ref<CustomPlaylist | null>(null)

// Create/edit form
const formName  = ref('')
const formDesc  = ref('')
const formYear  = ref(new Date().getFullYear())

// Track picker
const showPicker    = ref(false)
const pickerSearch  = ref('')
const pickerTab     = ref<'music' | 'podcasts'>('music')

const pickerTracks = computed(() => {
  const q = pickerSearch.value.toLowerCase()
  const tracks = pickerTab.value === 'podcasts' ? lib.tracks.filter(t => t.source === 'podcast') : lib.tracks.filter(t => t.source === 'music')
  return q ? tracks.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)) : tracks
})

// Drag-and-drop reorder state
const dragIdx = ref<number | null>(null)

// ── Helpers ─────────────────────────────────────────────
function coverUrl(path?: string) {
  if (!path) return null
  return `nyro-file://local?p=${encodeURIComponent(path)}`
}

function fmtDur(sec?: number) {
  if (!sec) return ''
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

function totalDuration(pl: CustomPlaylist) {
  const secs = pl.tracks.reduce((s, t) => s + (t.duration ?? 0), 0)
  if (!secs) return ''
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ── CRUD ────────────────────────────────────────────────
function openCreate() {
  editingPl.value = null
  formName.value  = ''
  formDesc.value  = ''
  formYear.value  = new Date().getFullYear()
  showCreate.value = true
}

function openEdit(pl: CustomPlaylist) {
  editingPl.value = pl
  formName.value  = pl.name
  formDesc.value  = pl.description
  formYear.value  = pl.year
  showCreate.value = true
}

function submitForm() {
  const name = formName.value.trim()
  if (!name) return
  if (editingPl.value) {
    plStore.update(editingPl.value.id, { name, description: formDesc.value.trim(), year: formYear.value })
  } else {
    const pl = plStore.create(name, formDesc.value.trim(), formYear.value)
    selected.value = pl
  }
  showCreate.value = false
}

function deletePl(pl: CustomPlaylist) {
  if (selected.value?.id === pl.id) selected.value = null
  plStore.remove(pl.id)
}

// ── Track picker ─────────────────────────────────────────
function isInPlaylist(track: LibraryTrack) {
  return selected.value?.tracks.some(t => t.id === track.id) ?? false
}

function toggleTrack(track: LibraryTrack) {
  if (!selected.value) return
  if (isInPlaylist(track)) {
    plStore.removeTrack(selected.value.id, track.id)
  } else {
    plStore.addTrack(selected.value.id, track)
  }
}

// ── Drag-drop reorder ────────────────────────────────────
function onDragStart(idx: number) { dragIdx.value = idx }
function onDrop(toIdx: number) {
  if (dragIdx.value === null || !selected.value) return
  plStore.reorderTrack(selected.value.id, dragIdx.value, toIdx)
  dragIdx.value = null
}
</script>

<template>
  <div class="playlists-page">

    <!-- Header -->
    <header class="pl-header">
      <h1 class="pl-title">Playlists</h1>
      <span class="pl-count">{{ plStore.playlists.length }} playlist{{ plStore.playlists.length !== 1 ? 's' : '' }}</span>
      <div class="spacer" />
      <button class="create-btn" @click="openCreate">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        New playlist
      </button>
    </header>

    <!-- Body -->
    <div class="pl-body">

      <!-- List panel -->
      <div class="list-panel" :class="{ narrow: !!selected }">
        <div v-if="plStore.playlists.length === 0" class="empty-state">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <p>No playlists yet.</p>
          <button class="create-btn-sm" @click="openCreate">Create one</button>
        </div>

        <div v-else class="pl-grid">
          <div
            v-for="pl in plStore.playlists" :key="pl.id"
            class="pl-card" :class="{ active: selected?.id === pl.id }"
            @click="selected = selected?.id === pl.id ? null : pl"
          >
            <!-- Cover mosaic (first 4 track covers) -->
            <div class="pl-art">
              <template v-if="pl.tracks.some(t => t.coverPath)">
                <div class="mosaic">
                  <div
                    v-for="(t, i) in pl.tracks.filter(t => t.coverPath).slice(0, 4)" :key="i"
                    class="mosaic-cell"
                    :style="{ backgroundImage: `url('${coverUrl(t.coverPath)}')` }"
                  />
                </div>
              </template>
              <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              <div class="pl-art-overlay">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
            </div>
            <div class="pl-card-label-row">
              <span class="pl-card-name">{{ pl.name }}</span>
              <div class="pl-card-actions" @click.stop>
                <button class="icon-btn" title="Edit" @click="openEdit(pl)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="icon-btn danger" title="Delete" @click="deletePl(pl)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                  </svg>
                </button>
              </div>
            </div>
            <span class="pl-card-meta">{{ pl.tracks.length }} tracks{{ totalDuration(pl) ? ` · ${totalDuration(pl)}` : '' }}</span>
          </div>
        </div>
      </div>

      <!-- Detail panel -->
      <Transition name="detail">
        <div v-if="selected" class="detail-panel">
          <div class="detail-header">
            <div class="detail-art">
              <div v-if="selected.tracks.some(t => t.coverPath)" class="mosaic mosaic--lg">
                <div
                  v-for="(t, i) in selected.tracks.filter(t => t.coverPath).slice(0, 4)" :key="i"
                  class="mosaic-cell"
                  :style="{ backgroundImage: `url('${coverUrl(t.coverPath)}')` }"
                />
              </div>
              <svg v-else width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </div>
            <div class="detail-meta">
              <span class="detail-label">PLAYLIST · {{ selected.year }}</span>
              <h2 class="detail-name">{{ selected.name }}</h2>
              <p v-if="selected.description" class="detail-desc">{{ selected.description }}</p>
              <span class="detail-sub">{{ selected.tracks.length }} tracks{{ totalDuration(selected) ? ` · ${totalDuration(selected)}` : '' }}</span>
              <div class="detail-actions">
                <button class="play-all-btn" :disabled="selected.tracks.length === 0" @click="player.play(selected.tracks)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Play all
                </button>
                <button class="add-tracks-btn" @click="showPicker = true">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add tracks
                </button>
              </div>
            </div>
          </div>

          <!-- Track list with drag-to-reorder -->
          <div v-if="selected.tracks.length === 0" class="detail-empty">
            <p>No tracks yet. Click <strong>Add tracks</strong> to get started.</p>
          </div>
          <div v-else class="detail-tracks">
            <div
              v-for="(track, i) in selected.tracks" :key="track.id"
              class="track-row"
              :class="{ playing: player.currentTrack?.id === track.id, 'drag-over': dragIdx !== null && dragIdx !== i }"
              draggable="true"
              @dragstart="onDragStart(i)"
              @dragover.prevent
              @drop="onDrop(i)"
              @dblclick="player.play(selected.tracks, i)"
            >
              <div class="drag-handle" title="Drag to reorder">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="10" r="1" fill="currentColor"/>
                  <circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/>
                  <circle cx="15" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/>
                </svg>
              </div>
              <span class="tr-num">{{ i + 1 }}</span>
              <div class="tr-thumb" :style="coverUrl(track.coverPath) ? { backgroundImage: `url('${coverUrl(track.coverPath)}')` } : {}">
                <svg v-if="!track.coverPath" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M9 18V5l12-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/>
                </svg>
              </div>
              <div class="tr-info">
                <span class="tr-title">{{ track.title }}</span>
                <span class="tr-artist">{{ track.artist }}</span>
              </div>
              <span class="tr-source" :class="track.source">{{ track.source }}</span>
              <span class="tr-dur">{{ fmtDur(track.duration) }}</span>
              <button class="remove-track-btn" title="Remove" @click.stop="plStore.removeTrack(selected!.id, track.id)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Create / Edit modal -->
    <Transition name="modal-fade">
      <div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false">
        <div class="modal">
          <h3 class="modal-title">{{ editingPl ? 'Edit playlist' : 'New playlist' }}</h3>
          <label class="field-label">Name</label>
          <input v-model="formName" class="field-input" placeholder="My playlist" maxlength="80" @keydown.enter="submitForm" />
          <label class="field-label">Description</label>
          <textarea v-model="formDesc" class="field-textarea" placeholder="Optional description…" rows="2" maxlength="300" />
          <label class="field-label">Year</label>
          <input v-model.number="formYear" type="number" class="field-input field-input--sm" :min="1900" :max="2099" />
          <div class="modal-footer">
            <button class="modal-btn ghost" @click="showCreate = false">Cancel</button>
            <button class="modal-btn primary" :disabled="!formName.trim()" @click="submitForm">
              {{ editingPl ? 'Save' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Track picker modal -->
    <Transition name="modal-fade">
      <div v-if="showPicker && selected" class="modal-backdrop" @click.self="showPicker = false">
        <div class="modal modal--wide">
          <h3 class="modal-title">Add tracks to "{{ selected.name }}"</h3>

          <div class="picker-tabs">
            <button :class="{ active: pickerTab === 'music' }" @click="pickerTab = 'music'">Music</button>
            <button :class="{ active: pickerTab === 'podcasts' }" @click="pickerTab = 'podcasts'">Podcasts</button>
          </div>

          <div class="picker-search-wrap">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input v-model="pickerSearch" class="picker-search" placeholder="Search…" />
          </div>

          <div v-if="lib.tracks.length === 0" class="picker-empty">
            Scan your library first to browse tracks.
          </div>
          <div v-else-if="pickerTracks.length === 0" class="picker-empty">No results.</div>
          <div v-else class="picker-list">
            <div
              v-for="track in pickerTracks" :key="track.id"
              class="picker-row"
              :class="{ checked: isInPlaylist(track) }"
              @click="toggleTrack(track)"
            >
              <div class="picker-check">
                <svg v-if="isInPlaylist(track)" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div class="tr-thumb" :style="coverUrl(track.coverPath) ? { backgroundImage: `url('${coverUrl(track.coverPath)}')` } : {}">
                <svg v-if="!track.coverPath" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M9 18V5l12-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/>
                </svg>
              </div>
              <div class="tr-info">
                <span class="tr-title">{{ track.title }}</span>
                <span class="tr-artist">{{ track.artist }}</span>
              </div>
              <span class="tr-dur">{{ fmtDur(track.duration) }}</span>
            </div>
          </div>

          <div class="modal-footer">
            <button class="modal-btn primary" @click="showPicker = false">Done</button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.playlists-page { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

/* ── Header ──────────────────────────────────────────── */
.pl-header {
  height: 52px; padding: 0 16px;
  display: flex; align-items: center; gap: 10px;
  background: linear-gradient(to bottom, var(--bg-1), var(--bg-0));
  border-bottom: 1px solid var(--line); flex-shrink: 0;
}
.pl-title { font-size: 15px; font-weight: 800; color: var(--tx); margin: 0; }
.pl-count { font-size: 10.5px; color: var(--tx-faint); background: var(--bg-2); padding: 2px 7px; border-radius: 20px; }
.spacer { flex: 1; }
.create-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 0 12px; height: 30px; border-radius: 8px;
  border: 1px solid rgba(136,192,208,0.3);
  background: linear-gradient(135deg, rgba(136,192,208,0.12), rgba(136,192,208,0.06));
  color: var(--accent); font-size: 12px; font-weight: 600; cursor: pointer;
  transition: box-shadow 0.15s;
}
.create-btn:hover { box-shadow: 0 0 10px rgba(136,192,208,0.25); }

/* ── Body ────────────────────────────────────────────── */
.pl-body { flex: 1; display: flex; overflow: hidden; }
.list-panel { flex: 1; overflow-y: auto; padding: 16px; transition: flex 0.2s; }
.list-panel.narrow { flex: 0 0 320px; border-right: 1px solid var(--line); }

/* ── Empty ───────────────────────────────────────────── */
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; height: 100%; color: var(--tx-faint);
}
.empty-state p { font-size: 13px; }
.create-btn-sm {
  padding: 6px 16px; border-radius: 8px;
  border: 1px solid var(--line-2); background: var(--bg-2);
  color: var(--tx-dim); font-size: 12px; cursor: pointer;
}
.create-btn-sm:hover { background: var(--bg-3); color: var(--tx); }

/* ── Playlist grid ───────────────────────────────────── */
.pl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 14px;
}
.pl-card {
  background: var(--bg-1); border: 1px solid var(--line);
  border-radius: 12px; cursor: pointer; overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.pl-card:hover { border-color: var(--line-2); box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
.pl-card.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }

/* ── Mosaic art ──────────────────────────────────────── */
.pl-art {
  width: 100%; aspect-ratio: 1;
  background: var(--bg-3);
  position: relative; overflow: hidden;
  display: flex; align-items: center; justify-content: center; color: var(--tx-faint);
}
.mosaic { display: grid; grid-template-columns: 1fr 1fr; width: 100%; height: 100%; }
.mosaic-cell { background: var(--bg-3) center/cover no-repeat; }
.mosaic--lg { width: 110px; height: 110px; border-radius: 10px; overflow: hidden; flex-shrink: 0; }
.pl-art-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.15s; color: #fff;
}
.pl-art:hover .pl-art-overlay { opacity: 1; }

.pl-card-label-row {
  display: flex; align-items: center; gap: 4px;
  padding: 8px 10px 2px;
}
.pl-card-name {
  font-size: 12.5px; font-weight: 600; color: var(--tx);
  flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pl-card-actions {
  display: flex; gap: 2px; opacity: 0; transition: opacity 0.12s;
}
.pl-card:hover .pl-card-actions { opacity: 1; }
.icon-btn {
  width: 22px; height: 22px; border: none; background: none;
  color: var(--tx-faint); cursor: pointer; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.12s, background 0.12s;
}
.icon-btn:hover { color: var(--tx); background: var(--bg-3); }
.icon-btn.danger:hover { color: var(--bad); }
.pl-card-meta {
  display: block; font-size: 11px; color: var(--tx-faint);
  padding: 0 10px 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ── Detail panel ────────────────────────────────────── */
.detail-panel { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.detail-header { display: flex; gap: 18px; align-items: flex-end; }
.detail-art {
  width: 110px; height: 110px; flex-shrink: 0;
  border-radius: 10px; background: var(--bg-3);
  display: flex; align-items: center; justify-content: center; color: var(--tx-faint);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4); overflow: hidden;
}
.detail-meta { display: flex; flex-direction: column; gap: 4px; }
.detail-label { font-size: 9.5px; font-weight: 700; color: var(--accent); letter-spacing: 0.1em; text-transform: uppercase; }
.detail-name { font-size: 20px; font-weight: 800; color: var(--tx); margin: 0; }
.detail-desc { font-size: 12px; color: var(--tx-dim); margin: 2px 0 0; }
.detail-sub { font-size: 12px; color: var(--tx-faint); }
.detail-actions { display: flex; gap: 8px; margin-top: 6px; align-items: center; }
.play-all-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 20px;
  background: var(--accent); color: var(--bg-0);
  border: none; font-size: 12px; font-weight: 700; cursor: pointer;
  transition: box-shadow 0.15s;
}
.play-all-btn:disabled { opacity: 0.4; cursor: default; }
.play-all-btn:not(:disabled):hover { box-shadow: 0 0 14px rgba(136,192,208,0.4); }
.add-tracks-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 20px;
  border: 1px solid var(--line-2); background: var(--bg-2);
  color: var(--tx-dim); font-size: 12px; font-weight: 600; cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.add-tracks-btn:hover { background: var(--bg-3); color: var(--tx); }

.detail-empty { padding: 40px 0; text-align: center; color: var(--tx-faint); font-size: 13px; }
.detail-empty strong { color: var(--accent); }
.detail-tracks { display: flex; flex-direction: column; gap: 1px; }

/* ── Track rows ──────────────────────────────────────── */
.track-row {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 8px; border-radius: 6px; cursor: pointer;
  transition: background 0.1s;
}
.track-row:hover { background: var(--bg-2); }
.track-row.playing { background: rgba(136,192,208,0.08); }
.track-row.playing .tr-title { color: var(--accent); }
.drag-handle {
  color: var(--tx-faint); cursor: grab; flex-shrink: 0; opacity: 0.4;
}
.track-row:hover .drag-handle { opacity: 1; }
.tr-num { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--tx-faint); width: 20px; text-align: right; flex-shrink: 0; }
.tr-thumb {
  width: 32px; height: 32px; border-radius: 4px; flex-shrink: 0;
  background: var(--bg-3) center/cover no-repeat;
  display: flex; align-items: center; justify-content: center; color: var(--tx-faint);
}
.tr-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.tr-title { font-size: 12.5px; font-weight: 600; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-artist { font-size: 10.5px; color: var(--tx-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-source {
  font-size: 9px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
  padding: 2px 6px; border-radius: 4px; flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
}
.tr-source.music   { background: rgba(136,192,208,0.12); color: var(--accent); }
.tr-source.podcast { background: rgba(163,190,140,0.12); color: var(--ok); }
.tr-dur { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--tx-faint); flex-shrink: 0; }
.remove-track-btn {
  width: 22px; height: 22px; border: none; background: none; color: var(--tx-faint);
  cursor: pointer; border-radius: 4px; display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.12s, color 0.12s;
}
.track-row:hover .remove-track-btn { opacity: 1; }
.remove-track-btn:hover { color: var(--bad); }

/* ── Modals ──────────────────────────────────────────── */
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 300; backdrop-filter: blur(3px);
}
.modal {
  background: var(--bg-1); border: 1px solid var(--line-2);
  border-radius: 14px; padding: 20px; width: 380px;
  display: flex; flex-direction: column; gap: 10px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.6);
}
.modal--wide { width: 480px; max-height: 80vh; }
.modal-title { font-size: 15px; font-weight: 800; color: var(--tx); margin: 0 0 2px; }
.field-label { font-size: 11px; font-weight: 600; color: var(--tx-faint); text-transform: uppercase; letter-spacing: 0.06em; }
.field-input {
  background: var(--bg-2); border: 1px solid var(--line-2); border-radius: 8px;
  color: var(--tx); font-size: 13px; padding: 8px 10px; outline: none; font-family: inherit;
}
.field-input:focus { border-color: var(--accent); }
.field-input--sm { width: 100px; }
.field-textarea {
  background: var(--bg-2); border: 1px solid var(--line-2); border-radius: 8px;
  color: var(--tx); font-size: 13px; padding: 8px 10px; outline: none; resize: vertical;
  font-family: inherit; line-height: 1.5;
}
.field-textarea:focus { border-color: var(--accent); }
.modal-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
.modal-btn {
  padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
  border: none; transition: opacity 0.12s, background 0.12s;
}
.modal-btn.primary { background: var(--accent); color: var(--bg-0); }
.modal-btn.primary:disabled { opacity: 0.4; cursor: default; }
.modal-btn.primary:not(:disabled):hover { opacity: 0.85; }
.modal-btn.ghost { background: var(--bg-2); color: var(--tx-dim); border: 1px solid var(--line-2); }
.modal-btn.ghost:hover { background: var(--bg-3); }

/* ── Picker ──────────────────────────────────────────── */
.picker-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--line); }
.picker-tabs button {
  padding: 6px 14px; border: none; background: none;
  color: var(--tx-faint); font-size: 12px; font-weight: 600; cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: color 0.12s, border-color 0.12s;
}
.picker-tabs button.active { color: var(--accent); border-bottom-color: var(--accent); }
.picker-search-wrap {
  display: flex; align-items: center; gap: 7px;
  background: var(--bg-2); border: 1px solid var(--line-2);
  border-radius: 8px; padding: 0 10px; height: 30px; color: var(--tx-faint);
}
.picker-search { background: none; border: none; outline: none; color: var(--tx); font-size: 12px; flex: 1; }
.picker-search::placeholder { color: var(--tx-faint); }
.picker-empty { padding: 20px 0; text-align: center; font-size: 12px; color: var(--tx-faint); }
.picker-list { overflow-y: auto; max-height: 340px; display: flex; flex-direction: column; gap: 1px; }
.picker-row {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 4px; border-radius: 6px; cursor: pointer;
  transition: background 0.1s;
}
.picker-row:hover { background: var(--bg-2); }
.picker-row.checked { background: rgba(136,192,208,0.08); }
.picker-check {
  width: 18px; height: 18px; border-radius: 5px;
  border: 1.5px solid var(--line-2); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: transparent; transition: background 0.12s, border-color 0.12s;
}
.picker-row.checked .picker-check { background: var(--accent); border-color: var(--accent); }

/* ── Transitions ─────────────────────────────────────── */
.detail-enter-active, .detail-leave-active { transition: opacity 0.15s, transform 0.15s; }
.detail-enter-from, .detail-leave-to { opacity: 0; transform: translateX(12px); }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.15s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
