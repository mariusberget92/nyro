<script setup lang="ts">
import { onMounted } from 'vue'
import Rail from './components/Rail.vue'
import MiniPlayer from './components/MiniPlayer.vue'
import ToastContainer from './components/ToastContainer.vue'
import { useQueueStore } from './stores/queueStore'
import { useSettingsStore } from './stores/settingsStore'
import { useIpc } from './composables/useIpc'

const queueStore = useQueueStore()
const settingsStore = useSettingsStore()

onMounted(async () => {
  await queueStore.loadQueue()
  await settingsStore.load()
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
  box-shadow: inset 4px 0 16px rgba(0,0,0,0.18);
}
.main-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-0);
}
</style>
