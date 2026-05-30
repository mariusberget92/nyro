<script setup lang="ts">
import { computed } from 'vue'
import { useQueueStore } from '../stores/queueStore'

const props = defineProps<{ selectedIds: Set<string> }>()
const emit = defineEmits<{ clear: [] }>()

const queueStore = useQueueStore()
const count = computed(() => props.selectedIds.size)

async function removeSelected() {
  for (const id of props.selectedIds) {
    await queueStore.removeItem(id)
  }
  emit('clear')
}
</script>

<template>
  <Transition name="batch">
    <div v-if="count > 0" class="batch-bar">
      <span class="count">{{ count }} selected</span>
      <div class="divider" />
      <button class="batch-btn danger" @click="removeSelected">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        </svg>
        Remove
      </button>
      <button class="batch-btn ghost" @click="emit('clear')">Cancel</button>
    </div>
  </Transition>
</template>

<style scoped>
.batch-bar {
  position: absolute;
  bottom: 36px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  background: rgba(20,27,38,0.92);
  backdrop-filter: blur(14px);
  border: 1px solid var(--line-2);
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  z-index: 100;
}
.count { font-size: 12.5px; font-weight: 600; color: var(--tx-dim); }
.divider { width: 1px; height: 18px; background: var(--line-2); }
.batch-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  border: none;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.12s;
}
.batch-btn.danger { background: var(--bad); color: #fff; }
.batch-btn.danger:hover { filter: brightness(1.1); }
.batch-btn.ghost { background: var(--bg-3); color: var(--tx-dim); }
.batch-btn.ghost:hover { color: var(--tx); }

.batch-enter-active { transition: all 0.2s ease-out; }
.batch-leave-active { transition: all 0.15s ease-in; }
.batch-enter-from, .batch-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }
</style>
