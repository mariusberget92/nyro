<script setup lang="ts">
import { ref } from 'vue'
import type { QueueItem } from '@shared/types/queue'
import DownloadForm from '../components/DownloadForm.vue'
import QueueList from '../components/QueueList.vue'
import BatchBar from '../components/BatchBar.vue'
import EditSheet from '../components/EditSheet.vue'
import { useQueueStore } from '../stores/queueStore'

const queueStore = useQueueStore()

const selectedIds = ref<Set<string>>(new Set())
const editItem = ref<QueueItem | null>(null)
const showForm = ref(false)

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function handleSave(_id: string, _artist: string, _title: string) {
  // TODO: wire up rename IPC when implemented
}
</script>

<template>
  <div class="dashboard">
    <!-- Toolbar -->
    <header class="toolbar">
      <h1 class="toolbar-title">Queue</h1>
      <span v-if="queueStore.pendingCount > 0" class="pending-count">
        {{ queueStore.pendingCount }} pending
      </span>
      <div class="spacer" />

      <div class="toolbar-actions">
        <!-- Toggle add form -->
        <button class="icon-btn" :class="{ active: showForm }" title="Add URL" @click="showForm = !showForm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        <!-- Clear completed -->
        <button
          v-if="queueStore.items.some(i => ['completed','cancelled','failed'].includes(i.status))"
          class="icon-btn"
          title="Clear completed"
          @click="queueStore.clearCompleted()"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          </svg>
        </button>

        <div class="sep" />

        <!-- Run queue -->
        <button v-if="!queueStore.isProcessing" class="primary-btn" @click="queueStore.startQueue()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none"/>
          </svg>
          Run queue
        </button>

        <template v-if="queueStore.isProcessing">
          <button v-if="!queueStore.isPaused" class="icon-btn" title="Pause" @click="queueStore.pauseQueue()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
          </button>
          <button v-else class="icon-btn" title="Resume" @click="queueStore.resumeQueue()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </button>
          <button class="icon-btn danger" title="Stop" @click="queueStore.stopQueue()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
            </svg>
          </button>
        </template>
      </div>
    </header>

    <!-- Add form -->
    <Transition name="form-slide">
      <div v-if="showForm" class="form-panel">
        <DownloadForm />
      </div>
    </Transition>

    <!-- Queue -->
    <div class="queue-scroll">
      <QueueList
        :selected-ids="selectedIds"
        @toggle-select="toggleSelect"
        @edit="editItem = $event"
      />
    </div>

    <!-- Footer -->
    <footer class="toolbar-footer">
      <span class="footer-info">{{ queueStore.items.length }} {{ queueStore.items.length === 1 ? 'item' : 'items' }}</span>
      <span class="footer-quality">MP3 · 320 kbps</span>
    </footer>

    <!-- Batch bar -->
    <BatchBar :selected-ids="selectedIds" @clear="selectedIds = new Set()" />

    <!-- Edit sheet -->
    <EditSheet :item="editItem" @close="editItem = null" @save="handleSave" />
  </div>
</template>

<style scoped>
.dashboard { display: flex; flex-direction: column; height: 100%; position: relative; overflow: hidden; }
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 18px;
  background: var(--bg-0);
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.toolbar-title { font-size: 17px; font-weight: 800; color: var(--tx); margin: 0; }
.pending-count { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--tx-faint); }
.spacer { flex: 1; }
.toolbar-actions { display: flex; align-items: center; gap: 4px; }
.sep { width: 1px; height: 20px; background: var(--line-2); margin: 0 4px; }
.icon-btn {
  width: 32px; height: 32px;
  border-radius: 8px; border: none;
  background: transparent; color: var(--tx-dim);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.12s, color 0.12s;
}
.icon-btn:hover { background: var(--bg-3); }
.icon-btn.active { background: var(--bg-3); color: var(--accent); }
.icon-btn.danger:hover { color: var(--bad); }
.primary-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 0 18px; height: 34px;
  background: var(--accent); color: #fff;
  border: none; border-radius: var(--radius);
  font-size: 12.5px; font-weight: 600; cursor: pointer;
  transition: filter 0.15s;
}
.primary-btn:hover { filter: brightness(1.12); }
.form-panel {
  padding: 14px 18px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.queue-scroll { flex: 1; overflow-y: auto; }
.toolbar-footer {
  display: flex; align-items: center; justify-content: space-between;
  height: 36px; padding: 0 18px;
  background: var(--bg-0); border-top: 1px solid var(--line);
  flex-shrink: 0;
}
.footer-info { font-size: 11px; color: var(--tx-faint); }
.footer-quality { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: var(--accent); }

.form-slide-enter-active { transition: all 0.18s ease-out; }
.form-slide-leave-active { transition: all 0.14s ease-in; }
.form-slide-enter-from, .form-slide-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
