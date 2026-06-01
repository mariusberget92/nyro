<script setup lang="ts">
import type { ViewMode } from '../stores/viewStore'

const props = defineProps<{ modelValue: ViewMode }>()
const emit = defineEmits<{ 'update:modelValue': [ViewMode] }>()

const MODES: { mode: ViewMode; title: string }[] = [
  { mode: 'details', title: 'Details' },
  { mode: 'list',    title: 'List' },
  { mode: 'small',   title: 'Small icons' },
  { mode: 'medium',  title: 'Medium icons' },
  { mode: 'large',   title: 'Large icons' },
  { mode: 'xlarge',  title: 'Extra large icons' },
]
</script>

<template>
  <div class="view-switcher">
    <!-- Details -->
    <button
      v-for="m in MODES" :key="m.mode"
      class="vs-btn" :class="{ active: modelValue === m.mode }" :title="m.title"
      @click="emit('update:modelValue', m.mode)"
    >
      <!-- Details icon: table rows -->
      <svg v-if="m.mode === 'details'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="3" y="5" width="18" height="3" rx="1"/><rect x="3" y="11" width="18" height="3" rx="1"/><rect x="3" y="17" width="18" height="3" rx="1"/>
      </svg>
      <!-- List icon: compact lines with thumbnail -->
      <svg v-else-if="m.mode === 'list'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="3" y="4" width="5" height="5" rx="1"/><line x1="10" y1="6" x2="21" y2="6"/>
        <rect x="3" y="11" width="5" height="5" rx="1"/><line x1="10" y1="13" x2="21" y2="13"/>
        <rect x="3" y="18" width="5" height="5" rx="1"/><line x1="10" y1="20" x2="21" y2="20"/>
      </svg>
      <!-- Small: 4-col grid dots -->
      <svg v-else-if="m.mode === 'small'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="2"  y="2"  width="4" height="4" rx="1"/>
        <rect x="8"  y="2"  width="4" height="4" rx="1"/>
        <rect x="14" y="2"  width="4" height="4" rx="1"/>
        <rect x="20" y="2"  width="2" height="4" rx="1"/>
        <rect x="2"  y="10" width="4" height="4" rx="1"/>
        <rect x="8"  y="10" width="4" height="4" rx="1"/>
        <rect x="14" y="10" width="4" height="4" rx="1"/>
        <rect x="20" y="10" width="2" height="4" rx="1"/>
        <rect x="2"  y="18" width="4" height="4" rx="1"/>
        <rect x="8"  y="18" width="4" height="4" rx="1"/>
        <rect x="14" y="18" width="4" height="4" rx="1"/>
        <rect x="20" y="18" width="2" height="4" rx="1"/>
      </svg>
      <!-- Medium: 3-col grid -->
      <svg v-else-if="m.mode === 'medium'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="2"  y="2"  width="6" height="6" rx="1"/>
        <rect x="10" y="2"  width="6" height="6" rx="1"/>
        <rect x="18" y="2"  width="4" height="6" rx="1"/>
        <rect x="2"  y="11" width="6" height="6" rx="1"/>
        <rect x="10" y="11" width="6" height="6" rx="1"/>
        <rect x="18" y="11" width="4" height="6" rx="1"/>
        <rect x="2"  y="19" width="6" height="3" rx="1"/>
        <rect x="10" y="19" width="6" height="3" rx="1"/>
      </svg>
      <!-- Large: 2-col grid -->
      <svg v-else-if="m.mode === 'large'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="2"  y="2"  width="9" height="9" rx="1"/>
        <rect x="13" y="2"  width="9" height="9" rx="1"/>
        <rect x="2"  y="13" width="9" height="9" rx="1"/>
        <rect x="13" y="13" width="9" height="9" rx="1"/>
      </svg>
      <!-- XLarge: 1-col big -->
      <svg v-else-if="m.mode === 'xlarge'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="2"  y="2"  width="20" height="9" rx="1"/>
        <rect x="2"  y="13" width="20" height="9" rx="1"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.view-switcher {
  display: flex; align-items: center;
  background: var(--bg-2); border-radius: 8px; padding: 3px; gap: 1px;
}
.vs-btn {
  width: 26px; height: 26px; border: none; border-radius: 5px;
  background: transparent; color: var(--tx-faint); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.1s, color 0.1s;
}
.vs-btn:hover { background: var(--bg-3); color: var(--tx-dim); }
.vs-btn.active { background: var(--accent-grad); color: #fff; box-shadow: 0 2px 8px -2px rgba(61,127,255,0.5); }
</style>
