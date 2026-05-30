<script setup lang="ts">
import { ref, computed } from 'vue'
import type { QueueItem } from '@shared/types/queue'
import StatusBadge from './StatusBadge.vue'
import ProgressBar from './ProgressBar.vue'
import { useQueueStore } from '../stores/queueStore'

const props = defineProps<{
  item: QueueItem
  index: number
  selected: boolean
  showIndex: boolean
}>()

const emit = defineEmits<{
  toggleSelect: [id: string]
  edit: [item: QueueItem]
}>()

const hovered = ref(false)
const queueStore = useQueueStore()

const indexStr = computed(() => String(props.index).padStart(3, '0'))

const thumbnailUrl = computed(() => {
  const meta = props.item.metadata
  if (!meta) return null
  if (meta.thumbnailUrl) return meta.thumbnailUrl
  return `https://img.youtube.com/vi/${meta.videoId}/mqdefault.jpg`
})

const title = computed(() => props.item.metadata?.title || props.item.url)
const artist = computed(() => props.item.metadata?.artist || '')

const duration = computed(() => {
  const d = props.item.metadata?.duration
  if (!d) return ''
  const m = Math.floor(d / 60)
  const s = Math.floor(d % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
})

const canRetry = computed(() => props.item.status === 'failed')
</script>

<template>
  <div
    class="queue-row"
    :class="{ hovered, selected }"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <!-- Checkbox -->
    <div class="check-wrap" @click.stop="emit('toggleSelect', item.id)">
      <div class="checkbox" :class="{ checked: selected }">
        <svg v-if="selected" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    </div>

    <!-- Grip -->
    <div v-show="hovered" class="grip">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
        <circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="10" r="1" fill="currentColor"/>
        <circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/>
        <circle cx="15" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/>
      </svg>
    </div>

    <!-- Index -->
    <span v-if="showIndex" class="index-num">{{ indexStr }}</span>

    <!-- Thumbnail -->
    <div class="thumb">
      <img v-if="thumbnailUrl" :src="thumbnailUrl" :alt="title" />
      <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
        <path d="M9 18V5l12-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/>
      </svg>
    </div>

    <!-- Track info -->
    <div class="track-info">
      <span class="track-title">{{ title }}</span>
      <span v-if="artist" class="track-artist">{{ artist }}</span>
    </div>

    <!-- Duration -->
    <span v-if="duration" class="duration">{{ duration }}</span>

    <!-- Status badge -->
    <StatusBadge :status="item.status" />

    <!-- Row actions (hover) -->
    <div v-show="hovered" class="row-actions">
      <button v-if="canRetry" class="action-btn" title="Retry" @click.stop="queueStore.addUrl(item.url)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
          <path d="M4 4v5h5M20 20v-5h-5"/><path d="M4.07 15a8 8 0 1014.07-8.36L20 4"/>
        </svg>
      </button>
      <button class="action-btn" title="Edit" @click.stop="emit('edit', item)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="action-btn danger" title="Remove" @click.stop="queueStore.removeItem(item.id)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
        </svg>
      </button>
    </div>

    <!-- Progress bar -->
    <ProgressBar :progress="item.progress || 0" :status="item.status" />
  </div>
</template>

<style scoped>
.queue-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 16px 0 8px;
  border-bottom: 1px solid var(--line);
  transition: background 0.12s;
  cursor: default;
}
.queue-row.hovered { background: var(--bg-2); }
.queue-row.selected { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.check-wrap {
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
}
.checkbox {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1.5px solid var(--line-2);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, border-color 0.12s;
}
.checkbox.checked { background: var(--accent); border-color: var(--accent); }
.grip {
  color: var(--tx-faint);
  flex-shrink: 0;
  cursor: grab;
}
.index-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--tx-faint);
  width: 28px;
  flex-shrink: 0;
  text-align: right;
}
.thumb {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--bg-3);
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tx-faint);
}
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.track-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.track-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--tx);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track-artist {
  font-size: 11.5px;
  color: var(--tx-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.duration {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--tx-faint);
  flex-shrink: 0;
}
.row-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.action-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--tx-dim);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, color 0.12s;
}
.action-btn:hover { background: var(--bg-3); color: var(--tx); }
.action-btn.danger:hover { color: var(--bad); }
</style>
