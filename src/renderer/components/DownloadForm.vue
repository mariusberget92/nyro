<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQueueStore } from '../stores/queueStore'
import { useToastStore } from '../stores/toastStore'

const PATTERNS = [
  /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
  /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
  /^(https?:\/\/)?(www\.)?youtube\.com\/playlist\?list=[\w-]+/,
  /^(https?:\/\/)?(music\.)?youtube\.com\/watch\?v=[\w-]+/,
  /^(https?:\/\/)?(music\.)?youtube\.com\/playlist\?list=[\w-]+/,
  /^(https?:\/\/)?(www\.)?soundcloud\.com\/.+/,
  /^(https?:\/\/)?.+\.bandcamp\.com\/.*/,
  /^(https?:\/\/)?bandcamp\.com\/.*/,
  /^(https?:\/\/)?(www\.)?vimeo\.com\/.+/,
]

const queueStore = useQueueStore()
const toastStore = useToastStore()

const input = ref('')
const loading = ref(false)
const error = ref('')
const batchProgress = ref('')   // e.g. "3 / 7"

// Batch mode when there are 2+ non-empty lines
const lines = computed(() =>
  input.value.split('\n').map(l => l.trim()).filter(Boolean)
)
const isBatch = computed(() => lines.value.length > 1)

function isValid(url: string) {
  return PATTERNS.some(p => p.test(url))
}

const validLines = computed(() => lines.value.filter(isValid))
const invalidCount = computed(() => lines.value.length - validLines.value.length)

async function handleAdd() {
  error.value = ''
  batchProgress.value = ''
  const urls = isBatch.value ? validLines.value : [input.value.trim()]
  if (!urls.length) { error.value = 'No valid URLs found'; return }
  if (!isBatch.value && !isValid(urls[0])) {
    error.value = 'Please enter a valid YouTube, SoundCloud, Bandcamp or Vimeo URL'
    return
  }

  loading.value = true
  let done = 0
  const errors: string[] = []

  for (const url of urls) {
    if (isBatch.value) batchProgress.value = `${done} / ${urls.length}`
    try {
      await queueStore.addUrl(url)
      done++
    } catch (e: any) {
      errors.push(e?.message || url)
    }
  }

  batchProgress.value = ''
  loading.value = false

  if (isBatch.value) {
    if (errors.length === 0) {
      toastStore.add(`Queued ${done} URL${done !== 1 ? 's' : ''}`, 'success')
    } else {
      toastStore.add(`Queued ${done}, ${errors.length} failed`, 'error')
    }
  } else if (errors.length) {
    error.value = errors[0]
    toastStore.add(errors[0], 'error')
    return
  } else {
    toastStore.add('Added to queue', 'success')
  }
  input.value = ''
}

function onKeydown(e: KeyboardEvent) {
  // Single-line mode: Enter submits. Batch mode: Ctrl+Enter submits.
  if (e.key === 'Enter' && (!isBatch.value || e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    handleAdd()
  }
}
</script>

<template>
  <div class="form-wrap">
    <!-- URL input — grows to textarea in batch mode -->
    <div class="input-row" :class="{ batch: isBatch }">
      <textarea
        v-model="input"
        class="url-input"
        :class="{ expanded: isBatch }"
        :rows="isBatch ? 4 : 1"
        :placeholder="isBatch
          ? `Paste one URL per line (${validLines.length} valid, ${invalidCount} invalid)…`
          : 'Paste a YouTube, SoundCloud, Bandcamp or Vimeo URL — or multiple URLs, one per line'"
        :disabled="loading"
        @keydown="onKeydown"
      />
      <button
        class="add-btn"
        :class="{ empty: !input.trim() && !loading }"
        :disabled="loading || !input.trim()"
        @click="handleAdd"
      >
        <svg v-if="!loading" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.3"/><path d="M21 12a9 9 0 00-9-9"/>
        </svg>
        <span v-if="batchProgress">{{ batchProgress }}</span>
        <span v-else-if="isBatch">Queue {{ validLines.length }}</span>
        <span v-else-if="loading">Adding…</span>
        <span v-else>Add to Queue</span>
      </button>
    </div>

    <div class="bottom-row">
      <p v-if="error" class="error-msg">{{ error }}</p>
      <p v-if="isBatch" class="batch-hint">
        {{ validLines.length }} valid URL{{ validLines.length !== 1 ? 's' : '' }}
        <template v-if="invalidCount > 0"> · {{ invalidCount }} skipped</template>
        <span class="hint-key">Ctrl+Enter to queue all</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.form-wrap { display: flex; flex-direction: column; gap: 6px; }

.input-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.url-input {
  flex: 1;
  min-height: 38px;
  padding: 9px 14px;
  background: var(--bg-2);
  border: 1.5px solid var(--line-2);
  border-radius: var(--radius);
  color: var(--tx);
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  outline: none;
  resize: none;
  transition: border-color 0.15s, min-height 0.2s;
  line-height: 1.5;
  overflow: hidden;
}
.url-input.expanded {
  overflow-y: auto;
  min-height: 80px;
}
.url-input::placeholder { color: var(--tx-faint); }
.url-input:focus { border-color: var(--accent); }
.url-input:disabled { opacity: 0.5; }

.add-btn {
  height: 38px;
  padding: 0 16px;
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
  align-self: flex-start;
}
.add-btn:hover:not(:disabled) { filter: brightness(1.15); }
.add-btn:disabled { cursor: not-allowed; }
.add-btn.empty { opacity: 0.35; }
.add-btn:disabled:not(.empty) { opacity: 0.65; }

.bottom-row { min-height: 16px; }
.error-msg { font-size: 11.5px; color: var(--bad); margin: 0; }
.batch-hint {
  font-size: 11px; color: var(--tx-faint); margin: 0;
  display: flex; align-items: center; gap: 8px;
}
.hint-key {
  font-size: 10px; color: var(--tx-faint);
  background: var(--bg-3); border: 1px solid var(--line-2);
  border-radius: 4px; padding: 1px 6px;
  font-family: 'JetBrains Mono', monospace;
}

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
