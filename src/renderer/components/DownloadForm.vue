<script setup lang="ts">
import { ref } from 'vue'
import { useQueueStore } from '../stores/queueStore'
import { useToastStore } from '../stores/toastStore'

const YOUTUBE_PATTERNS = [
  /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
  /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
  /^(https?:\/\/)?(www\.)?youtube\.com\/playlist\?list=[\w-]+/,
  /^(https?:\/\/)?(music\.)?youtube\.com\/watch\?v=[\w-]+/,
]

const queueStore = useQueueStore()
const toastStore = useToastStore()

const url = ref('')
const loading = ref(false)
const error = ref('')
const tab = ref<'song' | 'playlist'>('song')

function validate(v: string) {
  return YOUTUBE_PATTERNS.some(p => p.test(v.trim()))
}

async function handleAdd() {
  error.value = ''
  const trimmed = url.value.trim()
  if (!trimmed) return
  if (!validate(trimmed)) {
    error.value = 'Please enter a valid YouTube URL'
    return
  }
  loading.value = true
  try {
    await queueStore.addUrl(trimmed)
    toastStore.add('Added to queue', 'success')
    url.value = ''
  } catch (e: any) {
    error.value = e?.message || 'Failed to add URL'
    toastStore.add(error.value, 'error')
  } finally {
    loading.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') handleAdd()
}
</script>

<template>
  <div class="form-wrap">
    <div class="tabs">
      <button :class="['tab', { active: tab === 'song' }]" @click="tab = 'song'">Song</button>
      <button :class="['tab', { active: tab === 'playlist' }]" @click="tab = 'playlist'">Playlist</button>
    </div>
    <div class="input-row">
      <input
        v-model="url"
        class="url-input"
        :placeholder="tab === 'song' ? 'Paste YouTube video URL...' : 'Paste YouTube playlist URL...'"
        :disabled="loading"
        @keydown="onKeydown"
      />
      <button class="add-btn" :disabled="loading || !url.trim()" @click="handleAdd">
        <svg v-if="!loading" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.3"/><path d="M21 12a9 9 0 00-9-9"/></svg>
        {{ loading ? 'Adding...' : 'Add to Queue' }}
      </button>
    </div>
    <p v-if="error" class="error-msg">{{ error }}</p>
  </div>
</template>

<style scoped>
.form-wrap { display: flex; flex-direction: column; gap: 10px; }
.tabs { display: flex; gap: 4px; }
.tab {
  padding: 4px 12px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--tx-faint);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.tab:hover { background: var(--bg-3); color: var(--tx-dim); }
.tab.active { background: var(--bg-3); color: var(--tx); }
.input-row { display: flex; gap: 8px; }
.url-input {
  flex: 1;
  height: 38px;
  padding: 0 14px;
  background: var(--bg-2);
  border: 1.5px solid var(--line-2);
  border-radius: var(--radius);
  color: var(--tx);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.url-input::placeholder { color: var(--tx-faint); }
.url-input:focus { border-color: var(--accent); }
.url-input:disabled { opacity: 0.5; }
.add-btn {
  height: 38px;
  padding: 0 18px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  transition: filter 0.15s;
  flex-shrink: 0;
}
.add-btn:hover:not(:disabled) { filter: brightness(1.15); }
.add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.error-msg { font-size: 11.5px; color: var(--bad); margin: 0; }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
