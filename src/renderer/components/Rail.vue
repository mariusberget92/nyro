<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQueueStore } from '../stores/queueStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useBinaryStore } from '../stores/binaryStore'

const router = useRouter()
const route = useRoute()
const queueStore = useQueueStore()
const settingsStore = useSettingsStore()
const binary = useBinaryStore()

const activeCount = computed(() => queueStore.activeItems.length)
const qualityLabel = computed(() => {
  const s = settingsStore.settings
  if (s.downloadMode === 'video') return s.videoQuality
  return `${s.audioQuality}k`
})

const isDashboard  = computed(() => route.path === '/dashboard')
const isPodcasts   = computed(() => route.path === '/podcasts')
const isLibrary    = computed(() => route.path === '/library')
const isPlaylists  = computed(() => route.path === '/playlists')
const isHistory    = computed(() => route.path === '/history')
const isSettings   = computed(() => route.path === '/settings')
const isEqualizer  = computed(() => route.path === '/equalizer')
</script>

<template>
  <nav class="rail">

    <!-- Logo -->
    <div class="logo">
      <div class="logo-mark">
        <svg width="24" height="30" viewBox="0 0 26 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="4"  y1="3"  x2="4"  y2="19" stroke="white" stroke-width="3" stroke-linecap="round"/>
          <line x1="4"  y1="3"  x2="17" y2="19" stroke="white" stroke-width="3" stroke-linecap="round"/>
          <line x1="17" y1="3"  x2="17" y2="23" stroke="white" stroke-width="3" stroke-linecap="round"/>
          <line x1="17" y1="23" x2="13" y2="18" stroke="white" stroke-width="3" stroke-linecap="round"/>
          <line x1="17" y1="23" x2="21" y2="18" stroke="white" stroke-width="3" stroke-linecap="round"/>
          <line x1="13" y1="29" x2="22" y2="29" stroke="white" stroke-width="3" stroke-linecap="round"/>
        </svg>
      </div>
    </div>

    <!-- Nav -->
    <div class="nav-links">

      <button class="nav-btn" :class="{ active: isDashboard }" title="Queue" @click="router.push('/dashboard')">
        <div class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6"  x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6"  x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <span v-if="activeCount > 0" class="badge">{{ activeCount > 99 ? '99+' : activeCount }}</span>
        </div>
      </button>

      <button class="nav-btn" :class="{ active: isPodcasts }" title="Podcasts" @click="router.push('/podcasts')">
        <div class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8"  y1="23" x2="16" y2="23"/>
          </svg>
        </div>
      </button>

      <button class="nav-btn" :class="{ active: isLibrary }" title="Library" @click="router.push('/library')">
        <div class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
      </button>

      <button class="nav-btn" :class="{ active: isPlaylists }" title="Playlists" @click="router.push('/playlists')">
        <div class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8"  y1="6"  x2="21" y2="6" />
            <line x1="8"  y1="12" x2="21" y2="12"/>
            <line x1="8"  y1="18" x2="21" y2="18"/>
            <circle cx="3" cy="6"  r="1" fill="currentColor"/>
            <circle cx="3" cy="12" r="1" fill="currentColor"/>
            <circle cx="3" cy="18" r="1" fill="currentColor"/>
          </svg>
        </div>
      </button>

      <button class="nav-btn" :class="{ active: isHistory }" title="Play History" @click="router.push('/history')">
        <div class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="12 8 12 12 14 14"/>
            <path d="M3.05 11a9 9 0 1 0 .5-4.5"/>
            <polyline points="3 3 3 9 9 9"/>
          </svg>
        </div>
      </button>

      <button class="nav-btn" :class="{ active: isEqualizer }" title="Equalizer" @click="router.push('/equalizer')">
        <div class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4"  y1="21" x2="4"  y2="14"/>
            <line x1="4"  y1="10" x2="4"  y2="3"/>
            <line x1="12" y1="21" x2="12" y2="12"/>
            <line x1="12" y1="8"  x2="12" y2="3"/>
            <line x1="20" y1="21" x2="20" y2="16"/>
            <line x1="20" y1="12" x2="20" y2="3"/>
            <line x1="1"  y1="14" x2="7"  y2="14"/>
            <line x1="9"  y1="8"  x2="15" y2="8"/>
            <line x1="17" y1="16" x2="23" y2="16"/>
          </svg>
        </div>
      </button>


    </div>

    <div class="spacer" />

    <!-- Bottom: settings -->
    <div class="rail-bottom">

      <!-- Binary status pills -->
      <div class="binary-pills">
        <template v-if="binary.checking">
          <div class="bin-pill bin-pill--checking" title="Checking binaries…">
            <span class="bin-dot bin-dot--spin" />
            <span class="bin-label">Checking…</span>
          </div>
        </template>
        <template v-else>
          <div
            class="bin-pill"
            :class="binary.ytdlpOk ? 'bin-pill--ok' : 'bin-pill--err'"
            :title="binary.ytdlpOk ? ('yt-dlp ' + (binary.ytdlpVersion ?? '')).trim() : 'yt-dlp not found — downloads will fail'"
          >
            <span class="bin-dot" />
            <span class="bin-label">yt-dlp</span>
          </div>
          <div
            class="bin-pill"
            :class="binary.ffmpegOk ? 'bin-pill--ok' : 'bin-pill--err'"
            :title="binary.ffmpegOk ? ('FFmpeg ' + (binary.ffmpegVersion ?? '')).trim() : 'FFmpeg not found — audio conversion will fail'"
          >
            <span class="bin-dot" />
            <span class="bin-label">FFmpeg</span>
          </div>
        </template>
      </div>

      <button class="nav-btn" :class="{ active: isSettings }" title="Settings" @click="router.push('/settings')">
        <div class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </div>
      </button>
    </div>

  </nav>
</template>

<style scoped>
.rail {
  width: var(--rail-w);
  min-width: var(--rail-w);
  background: var(--bg-1);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 0 10px;
  height: 100vh;
  overflow: hidden;
  position: relative;
  z-index: 10;
}

/* ── Logo ─────────────────────────────────────── */
.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.logo-mark {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #3d7fff, #7c5cff);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(61,127,255,0.35);
}

/* ── Nav ──────────────────────────────────────── */
.nav-links {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
  padding: 0 8px;
  overflow-y: auto;
  overflow-x: hidden;
  flex-shrink: 1;
  min-height: 0;
}

.nav-btn {
  position: relative;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--tx-faint);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border-radius: 10px;
  transition: background 0.15s, color 0.15s;
}
.nav-btn:hover:not(:disabled) {
  background: var(--bg-2);
  color: var(--tx-dim);
}
.nav-btn.active {
  background: var(--accent-glow);
  color: var(--accent);
}
.nav-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.nav-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Badge ────────────────────────────────────── */
.badge {
  position: absolute;
  top: -5px;
  right: -7px;
  min-width: 15px;
  height: 15px;
  background: var(--accent);
  color: var(--bg-0);
  font-size: 8.5px;
  font-weight: 800;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  font-family: 'JetBrains Mono', monospace;
}

/* ── Coming soon dot ──────────────────────────── */
.soon-dot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--warn);
}

/* ── Bottom ───────────────────────────────────── */
.spacer { flex: 1; min-height: 8px; }
.rail-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 8px;
  flex-shrink: 0;
}

/* ── Binary status pills ─────────────────────────── */
.binary-pills {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 0 2px;
}
.bin-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.03em;
  cursor: default;
  transition: opacity 0.15s;
  width: 100%;
}
.bin-pill--ok  { background: color-mix(in srgb, #a3be8c 15%, transparent); color: #a3be8c; }
.bin-pill--err { background: color-mix(in srgb, #bf616a 15%, transparent); color: #bf616a; }
.bin-pill--checking { background: var(--bg-2); color: var(--tx-faint); }
.bin-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
.bin-pill--ok  .bin-dot { background: #a3be8c; box-shadow: 0 0 4px #a3be8c; }
.bin-pill--err .bin-dot { background: #bf616a; box-shadow: 0 0 4px #bf616a; }
.bin-pill--checking .bin-dot { background: var(--tx-faint); }
.bin-dot--spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.bin-label { flex: 1; }
.bin-version { opacity: 0.6; font-size: 8px; }
</style>
