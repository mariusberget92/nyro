<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHistoryStore } from '../stores/historyStore'
import { usePlayerStore } from '../stores/playerStore'
import { useViewStore } from '../stores/viewStore'
import ViewSwitcher from '../components/ViewSwitcher.vue'

const history = useHistoryStore()
const player = usePlayerStore()
const views = useViewStore()

const tab = ref<'recent' | 'top'>('recent')

const recent = computed(() => history.recentTracks)
const top    = computed(() => history.topTracks)

function fmt(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return d.toLocaleDateString()
}

function coverStyle(coverPath?: string | null) {
  if (!coverPath) return {}
  return { backgroundImage: `url("nyro-file://local?p=${encodeURIComponent(coverPath)}")` }
}
</script>

<template>
  <div class="history-page">
    <div class="page-header">
      <h1 class="page-title">Play History</h1>
      <div class="header-right">
        <ViewSwitcher :model-value="views.history" @update:model-value="views.set('history', $event)" />
        <div class="tab-bar">
          <button :class="{ active: tab === 'recent' }" @click="tab = 'recent'">Recent</button>
          <button :class="{ active: tab === 'top' }"    @click="tab = 'top'">Most Played</button>
        </div>
        <button v-if="history.entries.length" class="clear-btn" @click="history.clear()">Clear history</button>
      </div>
    </div>

    <!-- Recent tab -->
    <div v-if="tab === 'recent'" class="track-list" :class="`view-${views.history}`">
      <div v-if="!recent.length" class="empty-state">No play history yet. Start listening!</div>
      <div
        v-for="(entry, i) in recent" :key="i"
        class="track-row"
        @dblclick="player.playOne(entry.track)"
      >
        <div class="track-cover" :style="coverStyle(entry.track.coverPath)">
          <svg v-if="!entry.track.coverPath" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 18V5l12-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/>
          </svg>
        </div>
        <div class="track-info">
          <span class="track-title">{{ entry.track.title || '—' }}</span>
          <span class="track-artist">{{ entry.track.artist || entry.track.album || '—' }}</span>
        </div>
        <span class="track-time">{{ fmt(entry.playedAt) }}</span>
        <button class="play-row-btn" title="Play" @click="player.playOne(entry.track)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      </div>
    </div>

    <!-- Top played tab -->
    <div v-if="tab === 'top'" class="track-list" :class="`view-${views.history}`">
      <div v-if="!top.length" class="empty-state">No play history yet. Start listening!</div>
      <div
        v-for="(entry, i) in top" :key="entry.track.path"
        class="track-row"
        @dblclick="player.playOne(entry.track)"
      >
        <span class="rank-num">{{ i + 1 }}</span>
        <div class="track-cover" :style="coverStyle(entry.track.coverPath)">
          <svg v-if="!entry.track.coverPath" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 18V5l12-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/>
          </svg>
        </div>
        <div class="track-info">
          <span class="track-title">{{ entry.track.title || '—' }}</span>
          <span class="track-artist">{{ entry.track.artist || entry.track.album || '—' }}</span>
        </div>
        <span class="play-count">{{ entry.count }} play{{ entry.count !== 1 ? 's' : '' }}</span>
        <button class="play-row-btn" title="Play" @click="player.playOne(entry.track)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-page {
  display: flex; flex-direction: column; height: 100%; overflow: hidden;
}
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px 14px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.page-title {
  font-size: 18px; font-weight: 700; color: var(--tx); margin: 0;
}
.header-right {
  display: flex; align-items: center; gap: 12px;
}
.tab-bar {
  display: flex; background: var(--bg-2); border-radius: 8px; padding: 3px; gap: 2px;
}
.tab-bar button {
  padding: 4px 14px; border-radius: 6px; border: none; background: transparent;
  font-size: 12px; font-weight: 600; color: var(--tx-faint); cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.tab-bar button.active { background: var(--bg-0); color: var(--tx); }
.clear-btn {
  padding: 4px 12px; border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--bad) 50%, transparent);
  background: transparent; color: var(--bad); font-size: 11px; font-weight: 600;
  cursor: pointer; transition: background 0.1s;
}
.clear-btn:hover { background: color-mix(in srgb, var(--bad) 12%, transparent); }

.track-list {
  flex: 1; overflow-y: auto; padding: 8px 12px;
}
.empty-state {
  text-align: center; color: var(--tx-faint); font-size: 13px;
  padding: 60px 0;
}
.track-row {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 8px; border-radius: 8px;
  cursor: pointer; transition: background 0.1s;
}
.track-row:hover { background: var(--bg-2); }
.rank-num {
  width: 22px; text-align: right; font-size: 11px;
  color: var(--tx-faint); font-family: 'JetBrains Mono', monospace; flex-shrink: 0;
}
.track-cover {
  width: 36px; height: 36px; flex-shrink: 0;
  border-radius: 5px; background: var(--bg-3) center/cover no-repeat;
  display: flex; align-items: center; justify-content: center; color: var(--tx-faint);
}
.track-info {
  flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0;
}
.track-title {
  font-size: 12.5px; font-weight: 600; color: var(--tx);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.track-artist {
  font-size: 11px; color: var(--tx-faint);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.track-time, .play-count {
  font-size: 10.5px; color: var(--tx-faint); flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
}
.play-count { color: var(--accent); }
.play-row-btn {
  width: 26px; height: 26px; border-radius: 50%; border: none;
  background: var(--bg-3); color: var(--tx-faint); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.1s, background 0.1s;
  flex-shrink: 0;
}
.track-row:hover .play-row-btn { opacity: 1; }
.play-row-btn:hover { background: var(--accent); color: var(--bg-0); }

/* ── View mode overrides ─────────────────────── */
.view-small .track-row  { padding: 3px 6px; }
.view-small .track-cover { width: 28px; height: 28px; }
.view-large .track-row  { padding: 10px 10px; }
.view-large .track-cover, .view-xlarge .track-cover { width: 52px; height: 52px; }
.view-xlarge .track-row { padding: 12px 10px; }
.view-large .track-title, .view-xlarge .track-title { font-size: 14px; }
</style>
