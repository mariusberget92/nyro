<script setup lang="ts">
defineProps<{ message: string; type: 'success' | 'error' | 'info' }>()
defineEmits<{ close: [] }>()

const colors = { success: 'var(--ok)', error: 'var(--bad)', info: 'var(--accent)' }
</script>

<template>
  <div class="toast" :style="{ borderLeftColor: colors[type] }">
    <span class="toast-msg">{{ message }}</span>
    <button class="toast-close" @click="$emit('close')">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-1);
  border: 1px solid var(--line-2);
  border-left-width: 3px;
  border-radius: var(--radius);
  min-width: 240px;
  max-width: 360px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.toast-msg { flex: 1; font-size: 12.5px; color: var(--tx); }
.toast-close {
  background: transparent;
  border: none;
  color: var(--tx-faint);
  cursor: pointer;
  padding: 2px;
  display: flex;
}
.toast-close:hover { color: var(--tx); }
</style>
