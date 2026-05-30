<script setup lang="ts">
import { ref, watch } from 'vue'
import type { QueueItem } from '@shared/types/queue'
import { useSettingsStore } from '../stores/settingsStore'

const props = defineProps<{ item: QueueItem | null }>()
const emit = defineEmits<{ close: []; save: [id: string, artist: string, title: string] }>()

const settingsStore = useSettingsStore()
const artist = ref('')
const title = ref('')

watch(() => props.item, (item) => {
  if (item) {
    artist.value = item.metadata?.artist || ''
    title.value = item.metadata?.title || ''
  }
})

const preview = () => {
  const a = artist.value.trim() || 'Artist'
  const t = title.value.trim() || 'Title'
  return `${a} – ${t}.mp3`
}

function save() {
  if (!props.item) return
  emit('save', props.item.id, artist.value.trim(), title.value.trim())
  emit('close')
}
</script>

<template>
  <Transition name="sheet">
    <div v-if="item" class="sheet-overlay" @click.self="emit('close')">
      <div class="sheet">
        <div class="sheet-header">
          <h2 class="sheet-title">Edit Track</h2>
          <button class="close-btn" @click="emit('close')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="sheet-body">
          <label class="field-label">Artist</label>
          <input v-model="artist" class="field-input" placeholder="Artist name" />

          <label class="field-label">Song Title</label>
          <input v-model="title" class="field-input" placeholder="Song title" />

          <label class="field-label">Number Prefix</label>
          <button
            class="toggle-btn"
            :class="{ active: settingsStore.settings.numericPrefix }"
            @click="settingsStore.update({ numericPrefix: !settingsStore.settings.numericPrefix })"
          >
            <span class="toggle-knob" />
          </button>

          <div class="preview-block">
            <span class="preview-label">FILENAME PREVIEW</span>
            <span class="preview-value">{{ preview() }}</span>
          </div>
        </div>

        <div class="sheet-footer">
          <button class="btn-ghost" @click="emit('close')">Cancel</button>
          <button class="btn-primary" @click="save">Save</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
}
.sheet {
  width: 340px;
  height: 100%;
  background: var(--bg-1);
  border-left: 1px solid var(--line-2);
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 40px rgba(0,0,0,0.5);
}
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--line);
}
.sheet-title { font-size: 15px; font-weight: 700; color: var(--tx); margin: 0; }
.close-btn {
  width: 28px; height: 28px;
  border-radius: 6px; border: none;
  background: transparent; color: var(--tx-faint);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.close-btn:hover { background: var(--bg-3); color: var(--tx); }
.sheet-body { flex: 1; padding: 20px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.field-label { font-size: 10.5px; font-weight: 700; color: var(--tx-faint); letter-spacing: 0.05em; text-transform: uppercase; }
.field-input {
  height: 38px;
  padding: 0 12px;
  background: var(--bg-2);
  border: 1.5px solid var(--line-2);
  border-radius: 8px;
  color: var(--tx);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.field-input:focus { border-color: var(--accent); }
.toggle-btn {
  width: 40px; height: 22px;
  border-radius: 11px;
  border: none;
  background: var(--bg-3);
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
}
.toggle-btn.active { background: var(--accent); }
.toggle-knob {
  position: absolute;
  top: 3px; left: 3px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}
.toggle-btn.active .toggle-knob { transform: translateX(18px); }
.preview-block {
  margin-top: 8px;
  padding: 12px;
  background: var(--bg-2);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.preview-label { font-size: 10px; font-weight: 700; color: var(--tx-faint); text-transform: uppercase; letter-spacing: 0.05em; }
.preview-value { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ok); word-break: break-all; }
.sheet-footer {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--line);
}
.btn-ghost {
  flex: 1; height: 36px;
  background: var(--bg-3); color: var(--tx-dim);
  border: none; border-radius: 8px;
  font-size: 13px; font-weight: 600; cursor: pointer;
}
.btn-ghost:hover { color: var(--tx); }
.btn-primary {
  flex: 1; height: 36px;
  background: var(--accent); color: #fff;
  border: none; border-radius: 8px;
  font-size: 13px; font-weight: 600; cursor: pointer;
}
.btn-primary:hover { filter: brightness(1.1); }

.sheet-enter-active { transition: transform 0.25s ease-out; }
.sheet-leave-active { transition: transform 0.2s ease-in; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateX(100%); }
</style>
