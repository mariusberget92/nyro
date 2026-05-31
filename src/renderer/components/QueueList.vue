<script setup lang="ts">
import type { QueueItem } from '@shared/types/queue'
import type { ViewMode } from '../stores/viewStore'
import QueueCard from './QueueItem.vue'
import { useQueueStore } from '../stores/queueStore'
import { useSettingsStore } from '../stores/settingsStore'
import { computed } from 'vue'

const props = defineProps<{
  selectedIds: Set<string>
  viewMode?: ViewMode
}>()

const emit = defineEmits<{
  toggleSelect: [id: string]
  edit: [item: QueueItem]
}>()

const queueStore = useQueueStore()
const settingsStore = useSettingsStore()
const showIndex = computed(() => settingsStore.settings.numericPrefix)

const gridClass = computed(() => {
  switch (props.viewMode) {
    case 'details': return 'view-details'
    case 'list':    return 'view-list'
    case 'small':   return 'view-small'
    case 'large':   return 'view-large'
    case 'xlarge':  return 'view-xlarge'
    default:        return 'view-medium'
  }
})
</script>

<template>
  <div class="queue-list">
    <div class="card-grid" :class="gridClass">
      <QueueCard
        v-for="(item, idx) in queueStore.items"
        :key="item.id"
        :item="item"
        :index="idx + 1"
        :selected="selectedIds.has(item.id)"
        :show-index="showIndex"
        :view-mode="viewMode ?? 'medium'"
        @toggle-select="emit('toggleSelect', $event)"
        @edit="emit('edit', $event)"
      />
    </div>

    <div v-if="queueStore.items.length === 0" class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color: var(--tx-faint); margin-bottom: 12px">
        <path d="M9 18V5l12-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/>
      </svg>
      <p class="empty-title">Queue is empty</p>
      <p class="empty-sub">Paste a YouTube URL above to get started</p>
    </div>
  </div>
</template>

<style scoped>
.queue-list { display: flex; flex-direction: column; min-height: 100%; }

.card-grid {
  display: grid;
  gap: 14px;
  padding: 16px;
  align-content: start;
}
.view-small  { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
.view-medium { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
.view-large  { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.view-xlarge { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
/* List and Details use single column */
.view-list, .view-details {
  grid-template-columns: 1fr;
  gap: 2px;
  padding: 8px 12px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}
.empty-title { font-size: 14px; font-weight: 600; color: var(--tx-dim); margin: 0 0 4px; }
.empty-sub { font-size: 12px; color: var(--tx-faint); margin: 0; }

</style>
