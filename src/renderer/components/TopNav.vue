<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQueueStore } from '../stores/queueStore'
import { useBinaryStore } from '../stores/binaryStore'

const router = useRouter()
const route  = useRoute()
const queue  = useQueueStore()
const binary = useBinaryStore()

const totalBadge = computed(() => {
  const n = queue.activeItems.length
  return n > 0 ? (n > 99 ? '99+' : String(n)) : null
})

const tabs = [
  { label: 'Queue',     path: '/dashboard' },
  { label: 'Library',   path: '/library'   },
  { label: 'Podcasts',  path: '/podcasts'  },
  { label: 'Playlists', path: '/playlists' },
  { label: 'History',   path: '/history'   },
  { label: 'Equalizer', path: '/equalizer' },
]

function isActive(path: string) {
  return route.path === path || (path === '/dashboard' && route.path === '/')
}
</script>

<template>
  <header class="topbar">
    <!-- Titlebar row -->
    <div class="titlebar-row">
      <div class="traffic">
        <div class="dot r" />
        <div class="dot y" />
        <div class="dot g" />
      </div>
      <div class="logo-area">
        <div class="logo-mark">
          <svg width="16" height="16" viewBox="0 0 120 120" fill="none">
            <g stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">
              <path d="M38 36V79"/><path d="M38 36L82 84"/>
              <path d="M82 36V72"/><path d="M70 72L82 84L94 72"/>
              <path d="M49 100H83" stroke-width="12"/>
            </g>
          </svg>
        </div>
        <span class="logo-text">Nyro</span>
      </div>

      <div class="spacer" />

      <!-- Binary status pills -->
      <div class="binary-pills">
        <div v-if="binary.checking" class="bin-pill bin-pill--checking">
          <span class="bin-dot" /> Checking…
        </div>
        <template v-else>
          <div class="bin-pill" :class="binary.ytdlpOk ? 'bin-pill--ok' : 'bin-pill--err'"
               :title="binary.ytdlpOk ? 'yt-dlp OK' : 'yt-dlp not found'">
            <span class="bin-dot" /> yt-dlp
          </div>
          <div class="bin-pill" :class="binary.ffmpegOk ? 'bin-pill--ok' : 'bin-pill--err'"
               :title="binary.ffmpegOk ? 'FFmpeg OK' : 'FFmpeg not found'">
            <span class="bin-dot" /> FFmpeg
          </div>
        </template>
      </div>

      <button class="settings-btn" title="Settings" @click="router.push('/settings')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
        Settings
      </button>
    </div>

    <!-- Tab row -->
    <nav class="tab-row">
      <button
        v-for="tab in tabs" :key="tab.path"
        class="tab" :class="{ active: isActive(tab.path) }"
        @click="router.push(tab.path)"
      >
        {{ tab.label }}
        <span v-if="tab.path === '/dashboard' && totalBadge" class="tab-badge">{{ totalBadge }}</span>
      </button>
    </nav>
  </header>
</template>

<style scoped>
.topbar {
  background: var(--bg-0);
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
  -webkit-app-region: drag;
}
.titlebar-row {
  height: 38px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 10px;
  -webkit-app-region: drag;
}
.traffic { display: flex; gap: 6px; -webkit-app-region: no-drag; }
.dot { width: 12px; height: 12px; border-radius: 50%; }
.dot.r { background: #ff5f57; } .dot.y { background: #febc2e; } .dot.g { background: #28c840; }

.logo-area { display: flex; align-items: center; gap: 8px; -webkit-app-region: no-drag; }
.logo-mark {
  width: 26px; height: 26px; border-radius: 7px;
  background: var(--accent-grad);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px -4px rgba(61,127,255,.55);
  flex-shrink: 0;
}
.logo-text { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--tx); }
.spacer { flex: 1; }

.binary-pills { display: flex; gap: 5px; -webkit-app-region: no-drag; }
.bin-pill {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 999px;
  font-size: 10px; font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}
.bin-pill--ok      { background: color-mix(in srgb, var(--ok) 14%, transparent); color: var(--ok); }
.bin-pill--err     { background: color-mix(in srgb, var(--bad) 14%, transparent); color: var(--bad); }
.bin-pill--checking{ background: var(--bg-2); color: var(--tx-faint); }
.bin-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

.settings-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 10px; border-radius: 7px;
  background: var(--bg-2); border: none; cursor: pointer;
  color: var(--tx-dim); font-size: 12px; font-weight: 500;
  font-family: var(--font-sans);
  transition: background .15s, color .15s;
  -webkit-app-region: no-drag;
}
.settings-btn:hover { background: var(--bg-3); color: var(--tx); }

/* Tab row */
.tab-row {
  display: flex;
  padding: 0 12px;
  gap: 2px;
  height: 38px;
  align-items: flex-end;
  -webkit-app-region: no-drag;
}
.tab {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 14px;
  border: none; background: transparent; cursor: pointer;
  font-family: var(--font-sans); font-size: 13px; font-weight: 500;
  color: var(--tx-faint);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  border-radius: 6px 6px 0 0;
  transition: color .15s, background .15s;
}
.tab:hover { color: var(--tx-dim); background: var(--bg-2); }
.tab.active { color: var(--tx); border-bottom-color: var(--accent); }
.tab-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 16px; height: 16px; padding: 0 4px;
  border-radius: 8px; font-size: 9px; font-weight: 800;
  background: var(--accent-grad); color: #fff;
  font-family: 'JetBrains Mono', monospace;
}
</style>
