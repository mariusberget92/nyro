<script setup lang="ts">
import type { QueueItem } from '@shared/types/queue'
import type { ViewMode } from '../stores/viewStore'
import QueueCard from './QueueItem.vue'
import { useQueueStore } from '../stores/queueStore'
import { useSettingsStore } from '../stores/settingsStore'
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

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

const isRowMode = computed(() => props.viewMode === 'list' || props.viewMode === 'details')

// Row height for the virtual scroller in list/details modes
const rowHeight = computed(() => props.viewMode === 'details' ? 52 : 52)

// Grid column sizing for icon modes
const gridClass = computed(() => {
  switch (props.viewMode) {
    case 'small':  return 'view-small'
    case 'large':  return 'view-large'
    case 'xlarge': return 'view-xlarge'
    default:       return 'view-medium'
  }
})

// Approximate card height per mode for content-visibility contain-intrinsic-size
const cardIntrinsicHeight = computed(() => {
  switch (props.viewMode) {
    case 'small':  return '185px'
    case 'large':  return '320px'
    case 'xlarge': return '420px'
    default:       return '260px'
  }
})
</script>

<template>
  <div class="queue-list">
    <!-- ── List / Details: proper virtual scroller ── -->
    <RecycleScroller
      v-if="isRowMode && queueStore.items.length > 0"
      class="row-scroller"
      :items="queueStore.items"
      :item-size="rowHeight"
      key-field="id"
      v-slot="{ item, index }"
    >
      <QueueCard
        :item="item"
        :index="index + 1"
        :selected="selectedIds.has(item.id)"
        :show-index="showIndex"
        :view-mode="viewMode ?? 'list'"
        @toggle-select="emit('toggleSelect', $event)"
        @edit="emit('edit', $event)"
      />
    </RecycleScroller>

    <!-- ── Grid / Icon modes: CSS content-visibility virtualization ── -->
    <div
      v-else-if="!isRowMode && queueStore.items.length > 0"
      class="card-grid"
      :class="gridClass"
      :style="{ '--card-intrinsic-h': cardIntrinsicHeight }"
    >
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
.queue-list { display: flex; flex-direction: column; height: 100%; }

/* ── Virtual list scroller ── */
.row-scroller {
  flex: 1;
  height: 100%;
  padding: 8px 12px;
}

/* ── Grid layouts ── */
.card-grid {
  display: grid;
  gap: 14px;
  padding: 16px;
  align-content: start;
  overflow-y: auto;
  flex: 1;
}
.view-small  { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
.view-medium { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
.view-large  { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.view-xlarge { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }

/* content-visibility lets the browser skip layout+paint for offscreen cards.
   contain-intrinsic-size prevents scroll jump when cards enter the viewport. */
.card-grid :deep(.card) {
  content-visibility: auto;
  contain-intrinsic-size: 0 var(--card-intrinsic-h, 260px);
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
