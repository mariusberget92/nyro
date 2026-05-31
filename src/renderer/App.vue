<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import Rail from './components/Rail.vue'
import MiniPlayer from './components/MiniPlayer.vue'
import ToastContainer from './components/ToastContainer.vue'
import { useQueueStore } from './stores/queueStore'
import { useSettingsStore } from './stores/settingsStore'
import { useToastStore } from './stores/toastStore'
import { useLibraryStore } from './stores/libraryStore'
import { usePlayerStore } from './stores/playerStore'
import { useIpc } from './composables/useIpc'

const queueStore = useQueueStore()
const settingsStore = useSettingsStore()
const toastStore = useToastStore()
const libraryStore = useLibraryStore()
const player = usePlayerStore()

function onKeyDown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase() ?? ''
  const editable = (e.target as HTMLElement)?.isContentEditable
  if (['input', 'textarea', 'select'].includes(tag) || editable) return

  switch (e.key) {
    case ' ':
      e.preventDefault()
      player.togglePlay()
      break
    case 'ArrowRight':
      e.preventDefault()
      player.seekBy(e.shiftKey ? 30 : 5)
      break
    case 'ArrowLeft':
      e.preventDefault()
      player.seekBy(e.shiftKey ? -30 : -5)
      break
    case 'ArrowUp':
      e.preventDefault()
      player.setVolume(Math.min(1, player.volume + 0.05))
      break
    case 'ArrowDown':
      e.preventDefault()
      player.setVolume(Math.max(0, player.volume - 0.05))
      break
    case 'm':
    case 'M':
      player.toggleMute()
      break
    case 'n':
    case 'N':
      player.next()
      break
    case 'p':
    case 'P':
      player.prev()
      break
  }
}

onMounted(async () => {
  await queueStore.loadQueue()
  await settingsStore.load()
  await libraryStore.load()
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})

useIpc('queue:progress', (payload: any) => {
  queueStore.updateProgress(payload.id, payload.progress, payload.status)
})
useIpc('queue:status-changed', (payload: any) => {
  queueStore.updateStatus(payload.id, payload.status)
})
useIpc('queue:completed', (payload: any) => {
  queueStore.markCompleted(payload.id, payload.outputPath)
  if (settingsStore.settings.notifyOnDownloadComplete && Notification.permission === 'granted') {
    const item = queueStore.items.find(i => i.id === payload.id)
    const n = new Notification('Download complete', {
      body: item?.title || item?.url || 'Track ready',
      silent: true,
    })
    const dur = settingsStore.settings.notificationDuration
    if (dur > 0) setTimeout(() => n.close(), dur)
  }
})
useIpc('queue:error', (payload: any) => {
  queueStore.markFailed(payload.id, payload.error)
})
// Global media keys forwarded from main process
useIpc('media:playpause', () => player.togglePlay())
useIpc('media:next',      () => player.next())
useIpc('media:prev',      () => player.prev())
useIpc('media:stop',      () => { player.playing = false })

useIpc('updater:status', (payload: any) => {
  if (!payload.done) return
  if (payload.ytdlpUpdated) {
    toastStore.add(payload.message, 'success', 6000)
  } else if (payload.ffmpegMissing) {
    toastStore.add('FFmpeg not found in resources — audio conversion will fail', 'error', 8000)
  } else {
    toastStore.add(payload.message, 'info', 5000)
  }
})
</script>

<template>
  <div class="app-shell">
    <Rail />
    <div class="content-col">
      <main class="main-area">
        <RouterView />
      </main>
      <MiniPlayer />
    </div>
    <ToastContainer />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-canvas);
  color: var(--tx);
}
.content-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.main-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-0);
}
</style>
