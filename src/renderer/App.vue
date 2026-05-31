<script setup lang="ts">
import { onMounted } from 'vue'
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

onMounted(async () => {
  await queueStore.loadQueue()
  await settingsStore.load()
  await libraryStore.load()
})

useIpc('queue:progress', (payload: any) => {
  queueStore.updateProgress(payload.id, payload.progress, payload.status)
})
useIpc('queue:status-changed', (payload: any) => {
  queueStore.updateStatus(payload.id, payload.status)
})
useIpc('queue:completed', (payload: any) => {
  queueStore.markCompleted(payload.id, payload.outputPath)
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
