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
const outputFolderName = computed(() => {
  const folder = settingsStore.settings.outputFolder
  if (!folder) return 'Output'
  return folder.split(/[\\/]/).pop() || folder
})

const isDashboard = computed(() => route.path === '/dashboard')
const isPodcasts = computed(() => route.path === '/podcasts')
const isSettings = computed(() => route.path === '/settings')
</script>

<template>
  <nav class="rail">
    <!-- Logo -->
    <div class="logo">
      <div class="logo-mark">N</div>
    </div>

    <!-- Nav links -->
    <div class="nav-links">
      <!-- Queue -->
      <button
        class="nav-btn"
        :class="{ active: isDashboard }"
        title="Queue"
        @click="router.push('/dashboard')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
        </svg>
        <span v-if="activeCount > 0" class="badge">{{ activeCount > 99 ? '99+' : activeCount }}</span>
      </button>

      <!-- Podcasts -->
      <button
        class="nav-btn"
        :class="{ active: isPodcasts }"
        title="Podcasts"
        @click="router.push('/podcasts')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
          <path d="M19 10v2a7 7 0 01-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>

      <!-- Settings -->
      <button
        class="nav-btn"
        :class="{ active: isSettings }"
        title="Settings"
        @click="router.push('/settings')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </button>
    </div>

    <!-- Footer info -->
    <div class="rail-footer">
      <div class="folder-name" :title="settingsStore.settings.outputFolder">
        {{ outputFolderName }}
      </div>
      <div class="quality-label">320 kbps</div>
    </div>
  </nav>
</template>

<style scoped>
.rail {
  width: 60px;
  min-width: 60px;
  background: var(--bg-1);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 0;
  height: 100vh;
  overflow: hidden;
}

.logo {
  margin-bottom: 20px;
  margin-top: 4px;
}

.logo-mark {
  width: 36px;
  height: 36px;
  background: var(--accent);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.5px;
}

.nav-links {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.nav-btn {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--tx-faint);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.nav-btn:hover {
  background: var(--bg-2);
  color: var(--tx-dim);
}

.nav-btn.active {
  background: rgba(61, 127, 255, 0.15);
  color: var(--accent);
}

.badge {
  position: absolute;
  top: 5px;
  right: 5px;
  min-width: 16px;
  height: 16px;
  background: var(--accent);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
}

.rail-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding-bottom: 4px;
}

.folder-name {
  font-size: 9px;
  color: var(--tx-faint);
  max-width: 52px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.quality-label {
  font-size: 9px;
  font-weight: 600;
  color: var(--accent);
  font-family: 'JetBrains Mono', monospace;
}
</style>
