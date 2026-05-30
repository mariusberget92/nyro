<script setup lang="ts">
import { computed } from 'vue'
import type { QueueStatus } from '@shared/types/queue'

const props = defineProps<{ status: QueueStatus; clickable?: boolean }>()

const stateColor = computed(() => {
  switch (props.status) {
    case 'pending':
    case 'queued' as any:
      return 'var(--tx-faint)'
    case 'fetching':
    case 'downloading':
      return 'var(--accent)'
    case 'converting':
    case 'tagging':
      return 'var(--conv)'
    case 'paused':
      return 'var(--warn)'
    case 'completed':
      return 'var(--ok)'
    case 'failed':
    case 'cancelled':
      return 'var(--bad)'
    default:
      return 'var(--tx-faint)'
  }
})

const label = computed(() => {
  switch (props.status) {
    case 'fetching': return 'FETCHING'
    case 'downloading': return 'DOWNLOADING'
    case 'converting': return 'CONVERTING'
    case 'tagging': return 'TAGGING'
    case 'completed': return 'DONE'
    case 'failed': return 'FAILED'
    case 'cancelled': return 'CANCELLED'
    case 'paused': return 'PAUSED'
    default: return 'PENDING'
  }
})

const badgeStyle = computed(() => ({
  background: stateColor.value.startsWith('var')
    ? `color-mix(in srgb, ${stateColor.value} 15%, transparent)`
    : `${stateColor.value}26`,
  color: stateColor.value,
}))
</script>

<template>
  <span class="badge" :style="badgeStyle" :class="{ clickable }">{{ label }}</span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  white-space: nowrap;
  line-height: 1.4;
  font-family: 'JetBrains Mono', monospace;
}
.badge.clickable { cursor: pointer; }
.badge.clickable:hover { filter: brightness(1.2); }
</style>
