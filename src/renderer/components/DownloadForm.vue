<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQueueStore } from '../stores/queueStore'
import { useToastStore } from '../stores/toastStore'
import { useSettingsStore } from '../stores/settingsStore'

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
const settingsStore = useSettingsStore()

const input = ref('')
const loading = ref(false)
const error = ref('')
const batchProgress = ref('')   // e.g. "3 / 7"

// Per-download album override (empty = use metadata / playlist title)
const albumOverride = ref('')

// Per-download folder override (empty = use global setting)
const folderOverride = ref('')
const folderLabel = computed(() => {
  if (folderOverride.value) return folderOverride.value.split(/[\\/]/).pop() || folderOverride.value
  return settingsStore.settings.outputFolder
    ? settingsStore.settings.outputFolder.split(/[\\/]/).pop() || settingsStore.settings.outputFolder
    : 'No folder set'
})

async function pickFolder() {
  const picked = await window.nyro.invoke<string | null>('dialog:select-folder')
  if (picked) folderOverride.value = picked
}

function clearFolderOverride() {
  folderOverride.value = ''
}

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
      await queueStore.addUrl(url, folderOverride.value || undefined, albumOverride.value.trim() || undefined)
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

    <!-- Album + Folder row -->
    <div class="meta-row">
      <div class="album-field">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="meta-icon">
          <path d="M9 18V5l12-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/>
        </svg>
        <input
          v-model="albumOverride"
          class="album-input"
          placeholder="Album name (optional)"
          :disabled="loading"
          @keydown.enter.prevent="handleAdd"
        />
        <button v-if="albumOverride" class="folder-clear" title="Clear album" @click="albumOverride = ''">✕</button>
      </div>

      <div class="folder-field">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="meta-icon">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
        <span class="folder-label" :class="{ override: !!folderOverride }" :title="folderOverride || settingsStore.settings.outputFolder">{{ folderLabel }}</span>
        <span v-if="folderOverride" class="folder-badge">custom</span>
        <button class="folder-btn" @click="pickFolder">Browse…</button>
        <button v-if="folderOverride" class="folder-clear" title="Reset to default" @click="clearFolderOverride">✕</button>
      </div>
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

/* ── Album + Folder row ──────────────────────────── */
.meta-row {
  display: flex; gap: 6px; min-width: 0;
}
.album-field, .folder-field {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 10px; border-radius: var(--radius);
  background: var(--bg-2); border: 1px solid var(--line);
  font-size: 11px; color: var(--tx-faint);
  min-width: 0;
}
.album-field { flex: 1; }
.folder-field { flex: 1; }
.meta-icon { flex-shrink: 0; color: var(--tx-faint); }
.album-input {
  flex: 1; background: none; border: none; outline: none;
  color: var(--tx); font-size: 11px; font-family: inherit;
  min-width: 0;
}
.album-input::placeholder { color: var(--tx-faint); }
.album-input:disabled { opacity: 0.5; }
.folder-label {
  flex: 1; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-family: 'JetBrains Mono', monospace;
}
.folder-label.override { color: var(--accent); }
.folder-badge {
  flex-shrink: 0; font-size: 9px; font-weight: 700;
  padding: 1px 5px; border-radius: 3px;
  background: rgba(136,192,208,0.15); color: var(--accent);
  letter-spacing: 0.06em; text-transform: uppercase;
}
.folder-btn {
  flex-shrink: 0; padding: 2px 8px;
  background: var(--bg-3); border: 1px solid var(--line-2);
  color: var(--tx-dim); border-radius: 4px; font-size: 10.5px;
  cursor: pointer; transition: background 0.12s;
}
.folder-btn:hover { background: var(--bg-4); color: var(--tx); }
.folder-clear {
  flex-shrink: 0; width: 18px; height: 18px;
  background: none; border: none; color: var(--tx-faint);
  cursor: pointer; font-size: 10px; display: flex;
  align-items: center; justify-content: center; border-radius: 3px;
}
.folder-clear:hover { color: var(--bad); }

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
