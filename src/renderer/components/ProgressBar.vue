<script setup lang="ts">
import { computed } from 'vue'
import type { QueueStatus } from '@shared/types/queue'

const props = defineProps<{ progress: number; status: QueueStatus }>()

const color = computed(() => {
  if (props.status === 'converting' || props.status === 'tagging') return 'var(--conv)'
  if (props.status === 'completed') return 'var(--ok)'
  return 'var(--accent)'
})

const visible = computed(() =>
  ['downloading', 'converting', 'tagging', 'completed'].includes(props.status)
)
</script>

<template>
  <div v-if="visible" class="progress-track">
    <div class="progress-fill" :style="{ width: `${progress}%`, background: color }" />
  </div>
</template>

<style scoped>
.progress-track {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--line);
}
.progress-fill {
  height: 100%;
  transition: width 0.3s ease, background 0.3s ease;
  box-shadow: 0 0 4px currentColor;
}
</style>
