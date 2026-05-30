<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQueueStore } from '../stores/queueStore'
import { useSettingsStore } from '../stores/settingsStore'

const router = useRouter()
const route = useRoute()
const queueStore = useQueueStore()
const settingsStore = useSettingsStore()

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
const isSettings   = computed(() => route.path === '/settings')
</script>

<template>
  <nav class="rail">

    <!-- Logo -->
    <div class="logo">
      <div class="logo-mark">&gt;_</div>
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

    </div>

    <div class="spacer" />

    <!-- Bottom: settings -->
    <div class="rail-bottom">
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
}

/* ── Logo ─────────────────────────────────────── */
.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.logo-mark {
  width: 32px;
  height: 32px;
  background: var(--bg-2);
  border: 1.5px solid var(--accent);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: -0.5px;
}

/* ── Nav ──────────────────────────────────────── */
.nav-links {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
  padding: 0 8px;
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
  background: rgba(136,192,208,0.12);
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
.spacer { flex: 1; }
.rail-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 8px;
}
</style>
