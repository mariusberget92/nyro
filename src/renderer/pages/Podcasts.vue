<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TaddyEpisode, TaddySeries, TaddySearchResult } from '@shared/types/podcast'
import { useSettingsStore } from '../stores/settingsStore'
import { useQueueStore } from '../stores/queueStore'
import { useToastStore } from '../stores/toastStore'

const settingsStore = useSettingsStore()
const queueStore = useQueueStore()
const toastStore = useToastStore()

const hasCredentials = computed(() =>
  !!settingsStore.settings.taddyUserId && !!settingsStore.settings.taddyApiKey
)

const query = ref('')
const searchResults = ref<TaddySearchResult | null>(null)
const searching = ref(false)

const selectedShow = ref<TaddySeries | null>(null)
const loadingMore = ref(false)

const addingEpisodes = ref<Set<string>>(new Set())

function formatDate(epoch: number) {
  return new Date(epoch * 1000).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
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
    searchResults.value = await window.nyro.invoke<TaddySearchResult>('podcast:search-shows', query.value.trim())
  } catch (e: any) {
    toastStore.add(e?.message || 'Search failed', 'error')
  } finally {
    searching.value = false
  }
}

async function loadShow(uuid: string, page = 1) {
  if (page === 1) { searching.value = true; selectedShow.value = null }
  else loadingMore.value = true
  try {
    const result = await window.nyro.invoke<TaddySeries>('podcast:get-show', uuid, page)
    if (page === 1) {
      selectedShow.value = result
    } else if (selectedShow.value) {
      selectedShow.value = {
        ...result,
        episodes: [...selectedShow.value.episodes, ...result.episodes]
      }
    }
  } catch (e: any) {
    toastStore.add(e?.message || 'Failed to load show', 'error')
  } finally {
    searching.value = false
    loadingMore.value = false
  }
}

async function addEpisode(ep: TaddyEpisode) {
  const next = new Set(addingEpisodes.value)
  next.add(ep.uuid)
  addingEpisodes.value = next
  try {
    const item = await window.nyro.invoke('podcast:add-episode', ep.uuid)
    queueStore.items.push(item as any)
    toastStore.add(`Added: ${ep.name}`, 'success')
  } catch (e: any) {
    toastStore.add(e?.message || 'Failed to add episode', 'error')
  } finally {
    const n = new Set(addingEpisodes.value)
    n.delete(ep.uuid)
    addingEpisodes.value = n
  }
}

async function addAllEpisodes() {
  if (!selectedShow.value) return
  for (const ep of selectedShow.value.episodes) await addEpisode(ep)
  toastStore.add(`Added ${selectedShow.value.episodes.length} episodes to queue`, 'success')
}
</script>

<template>
  <div class="podcasts">
    <header class="toolbar">
      <h1 class="toolbar-title">
        <template v-if="selectedShow">
          <button class="back-btn" @click="selectedShow = null">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          {{ selectedShow.name }}
        </template>
        <template v-else>Podcasts</template>
      </h1>
      <div class="spacer" />
      <button v-if="selectedShow" class="primary-btn" @click="addAllEpisodes">Add all to queue</button>
    </header>

    <!-- No credentials -->
    <div v-if="!hasCredentials" class="no-key">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--tx-faint)">
        <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
      </svg>
      <p class="no-key-title">Taddy credentials required</p>
      <p class="no-key-sub">Add your User ID and API Key in <router-link to="/settings" class="link">Settings</router-link> to browse podcasts.</p>
    </div>

    <template v-else>
      <!-- Show detail -->
      <template v-if="selectedShow">
        <div class="show-header">
          <img v-if="selectedShow.imageUrl" :src="selectedShow.imageUrl" class="show-cover" :alt="selectedShow.name" />
          <div class="show-meta">
            <p class="show-author">{{ selectedShow.authorName }}</p>
            <p v-if="selectedShow.totalEpisodesCount" class="show-ep-count">{{ selectedShow.totalEpisodesCount }} episodes</p>
          </div>
        </div>
        <div class="episodes-scroll">
          <div v-for="ep in selectedShow.episodes" :key="ep.uuid" class="episode-row">
            <img v-if="ep.imageUrl" :src="ep.imageUrl" class="ep-thumb" :alt="ep.name" />
            <div v-else class="ep-thumb ep-thumb-placeholder">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
            </div>
            <div class="ep-info">
              <span class="ep-title">{{ ep.name }}</span>
              <span class="ep-date">{{ ep.datePublished ? formatDate(ep.datePublished) : '' }}</span>
            </div>
            <span v-if="ep.duration" class="ep-dur">{{ formatDuration(ep.duration) }}</span>
            <button class="add-ep-btn" :disabled="addingEpisodes.has(ep.uuid)" @click="addEpisode(ep)">
              <svg v-if="!addingEpisodes.has(ep.uuid)" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 00-9-9"/></svg>
            </button>
          </div>
          <div class="load-more-row">
            <button v-if="selectedShow.hasMore" class="load-more-btn" :disabled="loadingMore" @click="loadShow(selectedShow!.uuid, selectedShow!.page + 1)">
              {{ loadingMore ? 'Loading...' : 'Load more episodes' }}
            </button>
            <span v-else class="all-loaded">All episodes loaded</span>
          </div>
        </div>
      </template>

      <!-- Search view -->
      <template v-else>
        <div class="search-bar">
          <input v-model="query" class="search-input" placeholder="Search podcasts..." @keydown.enter="search" />
          <button class="primary-btn" :disabled="!query.trim() || searching" @click="search">
            <svg v-if="!searching" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 00-9-9"/></svg>
            {{ searching ? 'Searching...' : 'Search' }}
          </button>
        </div>

        <div class="results-scroll">
          <template v-if="searchResults?.series.length">
            <div v-for="s in searchResults.series" :key="s.uuid" class="show-card" @click="loadShow(s.uuid)">
              <img v-if="s.imageUrl" :src="s.imageUrl" class="card-thumb" :alt="s.name" />
              <div v-else class="card-thumb card-thumb-placeholder">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
              </div>
              <div class="card-info">
                <span class="card-title">{{ s.name }}</span>
                <span class="card-pub">{{ s.authorName }}</span>
                <span v-if="s.totalEpisodesCount" class="card-count">{{ s.totalEpisodesCount }} episodes</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" style="color:var(--tx-faint);flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </template>
          <div v-else class="empty-state">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color:var(--tx-faint)">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
            </svg>
            <p class="empty-title">Search for a podcast to get started</p>
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
  height: 52px; padding: 0 16px;
  background: var(--bg-0); border-bottom: 1px solid var(--line); flex-shrink: 0;
}
.toolbar-title { font-size: 15px; font-weight: 700; color: var(--tx); margin: 0; display: flex; align-items: center; gap: 8px; }
.spacer { flex: 1; }
.back-btn {
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: transparent; color: var(--tx-dim); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.back-btn:hover { background: var(--bg-3); }

.no-key {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px;
}
.no-key-title { font-size: 15px; font-weight: 700; color: var(--tx-dim); margin: 0; }
.no-key-sub { font-size: 12.5px; color: var(--tx-faint); margin: 0; }
.link { color: var(--accent); text-decoration: none; }
.link:hover { text-decoration: underline; }

.show-header {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px; border-bottom: 1px solid var(--line); flex-shrink: 0;
}
.show-cover { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; }
.show-meta { display: flex; flex-direction: column; gap: 3px; }
.show-author { font-size: 12px; color: var(--tx-dim); margin: 0; }
.show-ep-count { font-size: 11px; color: var(--tx-faint); margin: 0; font-family: 'JetBrains Mono', monospace; }

.search-bar {
  display: flex; gap: 8px; padding: 12px 16px;
  border-bottom: 1px solid var(--line); flex-shrink: 0;
}
.search-input {
  flex: 1; height: 36px; padding: 0 12px;
  background: var(--bg-2); border: 1.5px solid var(--line-2); border-radius: 8px;
  color: var(--tx); font-size: 13px; outline: none;
}
.search-input::placeholder { color: var(--tx-faint); }
.search-input:focus { border-color: var(--accent); }

.results-scroll, .episodes-scroll { flex: 1; overflow-y: auto; }

.show-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; border-bottom: 1px solid var(--line);
  cursor: pointer; transition: background 0.1s;
}
.show-card:hover { background: var(--bg-2); }
.card-thumb { width: 52px; height: 52px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
.card-thumb-placeholder { background: var(--bg-3); display: flex; align-items: center; justify-content: center; color: var(--tx-faint); }
.card-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.card-title { font-size: 13px; font-weight: 600; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-pub { font-size: 11.5px; color: var(--tx-dim); }
.card-count { font-size: 10.5px; color: var(--tx-faint); font-family: 'JetBrains Mono', monospace; }

.episode-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; border-bottom: 1px solid var(--line); transition: background 0.1s;
}
.episode-row:hover { background: var(--bg-2); }
.ep-thumb { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
.ep-thumb-placeholder { background: var(--bg-3); display: flex; align-items: center; justify-content: center; color: var(--tx-faint); }
.ep-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ep-title { font-size: 13px; font-weight: 600; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ep-date { font-size: 11px; color: var(--tx-faint); }
.ep-dur { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--tx-faint); flex-shrink: 0; }
.add-ep-btn {
  width: 28px; height: 28px; border-radius: 6px; border: 1.5px solid var(--line-2);
  background: transparent; color: var(--tx-dim); cursor: pointer;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.1s;
}
.add-ep-btn:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); color: #fff; }
.add-ep-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.load-more-row { padding: 16px; display: flex; justify-content: center; }
.load-more-btn {
  padding: 7px 22px; border-radius: 8px; border: 1.5px solid var(--line-2);
  background: transparent; color: var(--tx-dim); font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.load-more-btn:hover:not(:disabled) { background: var(--bg-3); color: var(--tx); }
.load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.all-loaded { font-size: 11.5px; color: var(--tx-faint); }

.empty-state {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 60px 20px;
}
.empty-title { font-size: 13px; color: var(--tx-dim); margin: 0; }

.primary-btn {
  display: flex; align-items: center; gap: 6px; padding: 0 14px; height: 34px;
  background: var(--accent); color: var(--bg-0); border: none; border-radius: 8px;
  font-size: 12.5px; font-weight: 600; cursor: pointer; flex-shrink: 0;
}
.primary-btn:hover:not(:disabled) { filter: brightness(1.1); }
.primary-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
