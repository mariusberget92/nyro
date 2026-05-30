<script setup lang="ts">
import { ref, computed } from 'vue'
import type { LNEpisode, LNPodcast, LNSearchResult } from '@shared/types/podcast'
import { useSettingsStore } from '../stores/settingsStore'
import { useQueueStore } from '../stores/queueStore'
import { useToastStore } from '../stores/toastStore'

const settingsStore = useSettingsStore()
const queueStore = useQueueStore()
const toastStore = useToastStore()

const hasApiKey = computed(() => !!settingsStore.settings.listenNotesApiKey)

// Search state
const query = ref('')
const tab = ref<'shows' | 'episodes'>('shows')
const searchResults = ref<LNSearchResult | null>(null)
const searching = ref(false)

// Show detail state
const selectedShow = ref<LNPodcast | null>(null)
const loadingMore = ref(false)
const showUrlInput = ref('')

// Per-episode loading
const addingEpisodes = ref<Set<string>>(new Set())

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

async function search() {
  if (!query.value.trim()) return
  searching.value = true
  searchResults.value = null
  selectedShow.value = null
  try {
    const channel = tab.value === 'shows' ? 'podcast:search-shows' : 'podcast:search-episodes'
    searchResults.value = await window.nyro.invoke<LNSearchResult>(channel, query.value.trim())
  } catch (e: any) {
    toastStore.add(e?.message || 'Search failed', 'error')
  } finally {
    searching.value = false
  }
}

async function loadShow(idOrUrl: string) {
  searching.value = true
  selectedShow.value = null
  try {
    selectedShow.value = await window.nyro.invoke<LNPodcast>('podcast:get-show', idOrUrl)
  } catch (e: any) {
    toastStore.add(e?.message || 'Failed to load show', 'error')
  } finally {
    searching.value = false
  }
}

async function loadMore() {
  if (!selectedShow.value || selectedShow.value.next_episode_pub_date === null) return
  loadingMore.value = true
  try {
    const more = await window.nyro.invoke<LNPodcast>(
      'podcast:get-show',
      selectedShow.value.id,
      selectedShow.value.next_episode_pub_date
    )
    selectedShow.value = {
      ...more,
      episodes: [...selectedShow.value.episodes, ...more.episodes]
    }
  } catch (e: any) {
    toastStore.add(e?.message || 'Failed to load more episodes', 'error')
  } finally {
    loadingMore.value = false
  }
}

async function addEpisode(ep: LNEpisode) {
  const next = new Set(addingEpisodes.value)
  next.add(ep.id)
  addingEpisodes.value = next
  try {
    const item = await window.nyro.invoke('podcast:add-episode', ep.id)
    queueStore.items.push(item as any)
    toastStore.add(`Added: ${ep.title}`, 'success')
  } catch (e: any) {
    toastStore.add(e?.message || 'Failed to add episode', 'error')
  } finally {
    const next2 = new Set(addingEpisodes.value)
    next2.delete(ep.id)
    addingEpisodes.value = next2
  }
}

async function addAllEpisodes() {
  if (!selectedShow.value) return
  for (const ep of selectedShow.value.episodes) {
    await addEpisode(ep)
  }
  toastStore.add(`Added ${selectedShow.value.episodes.length} episodes to queue`, 'success')
}

function onUrlKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') loadShow(showUrlInput.value.trim())
}

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') search()
}
</script>

<template>
  <div class="podcasts">
    <!-- Toolbar -->
    <header class="toolbar">
      <h1 class="toolbar-title">
        <template v-if="selectedShow">
          <button class="back-btn" @click="selectedShow = null">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          {{ selectedShow.title }}
        </template>
        <template v-else>Podcasts</template>
      </h1>
      <div class="spacer" />
      <button v-if="selectedShow" class="primary-btn" @click="addAllEpisodes">
        Add all to queue
      </button>
    </header>

    <!-- No API key warning -->
    <div v-if="!hasApiKey" class="no-key">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--tx-faint)">
        <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
      </svg>
      <p class="no-key-title">ListenNotes API key required</p>
      <p class="no-key-sub">Add your free API key in <router-link to="/settings" class="link">Settings</router-link> to browse podcasts.</p>
      <a class="link" href="#" @click.prevent>Get a free key at listennotes.com/api</a>
    </div>

    <template v-else>
      <!-- Show detail view -->
      <template v-if="selectedShow">
        <div class="show-header">
          <img v-if="selectedShow.image" :src="selectedShow.image" class="show-cover" :alt="selectedShow.title" />
          <div class="show-meta">
            <p class="show-publisher">{{ selectedShow.publisher }}</p>
            <p class="show-ep-count">{{ selectedShow.total_episodes }} episodes</p>
          </div>
        </div>
        <div class="episodes-scroll">
          <div v-for="ep in selectedShow.episodes" :key="ep.id" class="episode-row">
            <img v-if="ep.image" :src="ep.image" class="ep-thumb" :alt="ep.title" />
            <div v-else class="ep-thumb ep-thumb-placeholder">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
            </div>
            <div class="ep-info">
              <span class="ep-title">{{ ep.title }}</span>
              <span class="ep-date">{{ formatDate(ep.pub_date_ms) }}</span>
            </div>
            <span class="ep-dur">{{ formatDuration(ep.audio_length_sec) }}</span>
            <button
              class="add-ep-btn"
              :disabled="addingEpisodes.has(ep.id)"
              @click="addEpisode(ep)"
            >
              <svg v-if="!addingEpisodes.has(ep.id)" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 00-9-9"/></svg>
            </button>
          </div>

          <!-- Load more -->
          <div class="load-more-row">
            <button
              v-if="selectedShow.next_episode_pub_date !== null"
              class="load-more-btn"
              :disabled="loadingMore"
              @click="loadMore"
            >
              {{ loadingMore ? 'Loading...' : 'Load more episodes' }}
            </button>
            <span v-else class="all-loaded">All episodes loaded</span>
          </div>
        </div>
      </template>

      <!-- Search / browse view -->
      <template v-else>
        <!-- URL browse input -->
        <div class="url-bar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" style="color:var(--tx-faint);flex-shrink:0"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
          <input
            v-model="showUrlInput"
            class="url-input"
            placeholder="Paste a ListenNotes podcast URL to browse episodes..."
            @keydown="onUrlKeydown"
          />
          <button class="ghost-btn" :disabled="!showUrlInput.trim() || searching" @click="loadShow(showUrlInput.trim())">
            Browse
          </button>
        </div>

        <!-- Search bar -->
        <div class="search-bar">
          <div class="tabs">
            <button :class="['tab', { active: tab === 'shows' }]" @click="tab = 'shows'">Shows</button>
            <button :class="['tab', { active: tab === 'episodes' }]" @click="tab = 'episodes'">Episodes</button>
          </div>
          <div class="search-row">
            <input v-model="query" class="search-input" placeholder="Search podcasts..." @keydown="onSearchKeydown" />
            <button class="primary-btn" :disabled="!query.trim() || searching" @click="search">
              <svg v-if="!searching" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 00-9-9"/></svg>
              {{ searching ? 'Searching...' : 'Search' }}
            </button>
          </div>
        </div>

        <!-- Results -->
        <div class="results-scroll">
          <template v-if="searchResults">
            <!-- Show results -->
            <template v-if="tab === 'shows'">
              <div
                v-for="r in searchResults.results"
                :key="r.id"
                class="show-card"
                @click="loadShow(r.id)"
              >
                <img v-if="r.image" :src="r.image" class="card-thumb" :alt="r.title_original" />
                <div v-else class="card-thumb card-thumb-placeholder">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
                </div>
                <div class="card-info">
                  <span class="card-title">{{ r.title_original }}</span>
                  <span class="card-pub">{{ r.publisher_original }}</span>
                  <span v-if="r.total_episodes" class="card-count">{{ r.total_episodes }} episodes</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" style="color:var(--tx-faint);flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </template>

            <!-- Episode results -->
            <template v-else>
              <div v-for="r in searchResults.results" :key="r.id" class="episode-row">
                <img v-if="r.image" :src="r.image" class="ep-thumb" :alt="r.title_original" />
                <div v-else class="ep-thumb ep-thumb-placeholder">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
                </div>
                <div class="ep-info">
                  <span class="ep-title">{{ r.title_original }}</span>
                  <span class="ep-date">{{ r.podcast?.title_original }} · {{ r.pub_date_ms ? formatDate(r.pub_date_ms) : '' }}</span>
                </div>
                <span v-if="r.audio_length_sec" class="ep-dur">{{ formatDuration(r.audio_length_sec) }}</span>
                <button
                  class="add-ep-btn"
                  :disabled="addingEpisodes.has(r.id)"
                  @click="addEpisode({ id: r.id, title: r.title_original, audio: r.audio || '', audio_length_sec: r.audio_length_sec || 0, pub_date_ms: r.pub_date_ms || 0, description: '', image: r.image, podcast: { id: r.podcast?.id || '', title: r.podcast?.title_original || '', publisher: r.publisher_original } })"
                >
                  <svg v-if="!addingEpisodes.has(r.id)" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 00-9-9"/></svg>
                </button>
              </div>
            </template>
          </template>

          <!-- Empty state -->
          <div v-else class="empty-state">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color:var(--tx-faint)">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
            </svg>
            <p class="empty-title">Search for a podcast or paste a URL</p>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.podcasts { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.toolbar {
  display: flex; align-items: center; gap: 10px;
  height: 56px; padding: 0 18px;
  background: var(--bg-0); border-bottom: 1px solid var(--line); flex-shrink: 0;
}
.toolbar-title { font-size: 17px; font-weight: 800; color: var(--tx); margin: 0; display: flex; align-items: center; gap: 8px; }
.spacer { flex: 1; }
.back-btn {
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: transparent; color: var(--tx-dim); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.back-btn:hover { background: var(--bg-3); }

/* No API key */
.no-key {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 40px;
}
.no-key-title { font-size: 15px; font-weight: 700; color: var(--tx-dim); margin: 0; }
.no-key-sub { font-size: 12.5px; color: var(--tx-faint); margin: 0; }
.link { color: var(--accent); text-decoration: none; font-size: 12.5px; }
.link:hover { text-decoration: underline; }

/* Show header */
.show-header {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px; border-bottom: 1px solid var(--line); flex-shrink: 0;
}
.show-cover { width: 64px; height: 64px; border-radius: 10px; object-fit: cover; }
.show-meta { display: flex; flex-direction: column; gap: 4px; }
.show-publisher { font-size: 12px; color: var(--tx-dim); margin: 0; }
.show-ep-count { font-size: 11px; color: var(--tx-faint); margin: 0; font-family: 'JetBrains Mono', monospace; }

/* URL bar */
.url-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 18px; border-bottom: 1px solid var(--line); flex-shrink: 0;
  background: var(--bg-1);
}
.url-input {
  flex: 1; height: 34px; padding: 0 12px;
  background: var(--bg-2); border: 1.5px solid var(--line-2); border-radius: 8px;
  color: var(--tx); font-size: 12.5px; outline: none;
}
.url-input::placeholder { color: var(--tx-faint); }
.url-input:focus { border-color: var(--accent); }

/* Search bar */
.search-bar {
  padding: 12px 18px; border-bottom: 1px solid var(--line);
  display: flex; flex-direction: column; gap: 10px; flex-shrink: 0;
}
.tabs { display: flex; gap: 4px; }
.tab {
  padding: 4px 12px; border-radius: 6px; border: none;
  background: transparent; color: var(--tx-faint);
  font-size: 12px; font-weight: 600; cursor: pointer;
}
.tab:hover { background: var(--bg-3); color: var(--tx-dim); }
.tab.active { background: var(--bg-3); color: var(--tx); }
.search-row { display: flex; gap: 8px; }
.search-input {
  flex: 1; height: 36px; padding: 0 12px;
  background: var(--bg-2); border: 1.5px solid var(--line-2); border-radius: 8px;
  color: var(--tx); font-size: 13px; outline: none;
}
.search-input::placeholder { color: var(--tx-faint); }
.search-input:focus { border-color: var(--accent); }

/* Results */
.results-scroll, .episodes-scroll { flex: 1; overflow-y: auto; }

/* Show card */
.show-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 18px; border-bottom: 1px solid var(--line);
  cursor: pointer; transition: background 0.12s;
}
.show-card:hover { background: var(--bg-2); }
.card-thumb {
  width: 56px; height: 56px; border-radius: 8px; object-fit: cover; flex-shrink: 0;
}
.card-thumb-placeholder {
  background: var(--bg-3); display: flex; align-items: center; justify-content: center; color: var(--tx-faint);
}
.card-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.card-title { font-size: 13.5px; font-weight: 600; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-pub { font-size: 11.5px; color: var(--tx-dim); }
.card-count { font-size: 10.5px; color: var(--tx-faint); font-family: 'JetBrains Mono', monospace; }

/* Episode row */
.episode-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 18px; border-bottom: 1px solid var(--line); transition: background 0.12s;
}
.episode-row:hover { background: var(--bg-2); }
.ep-thumb {
  width: 40px; height: 40px; border-radius: 7px; object-fit: cover; flex-shrink: 0;
}
.ep-thumb-placeholder {
  background: var(--bg-3); display: flex; align-items: center; justify-content: center; color: var(--tx-faint);
}
.ep-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ep-title { font-size: 13px; font-weight: 600; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ep-date { font-size: 11px; color: var(--tx-faint); }
.ep-dur { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--tx-faint); flex-shrink: 0; }
.add-ep-btn {
  width: 30px; height: 30px; border-radius: 7px; border: 1.5px solid var(--line-2);
  background: transparent; color: var(--tx-dim); cursor: pointer;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: all 0.12s;
}
.add-ep-btn:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); color: #fff; }
.add-ep-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Load more */
.load-more-row { padding: 16px; display: flex; justify-content: center; }
.load-more-btn {
  padding: 8px 24px; border-radius: 8px; border: 1.5px solid var(--line-2);
  background: transparent; color: var(--tx-dim); font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.load-more-btn:hover:not(:disabled) { background: var(--bg-3); color: var(--tx); }
.load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.all-loaded { font-size: 11.5px; color: var(--tx-faint); }

/* Empty state */
.empty-state {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 60px 20px;
}
.empty-title { font-size: 13.5px; font-weight: 600; color: var(--tx-dim); margin: 0; }

/* Buttons */
.primary-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 0 16px; height: 34px;
  background: var(--accent); color: #fff;
  border: none; border-radius: 8px;
  font-size: 12.5px; font-weight: 600; cursor: pointer; flex-shrink: 0;
}
.primary-btn:hover:not(:disabled) { filter: brightness(1.12); }
.primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ghost-btn {
  padding: 0 14px; height: 34px; border-radius: 8px; border: 1.5px solid var(--line-2);
  background: transparent; color: var(--tx-dim); font-size: 12.5px; font-weight: 600; cursor: pointer; flex-shrink: 0;
}
.ghost-btn:hover:not(:disabled) { color: var(--tx); background: var(--bg-3); }
.ghost-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
