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
const showError = ref(false)
const rowEl = ref<HTMLElement | null>(null)
const queueStore = useQueueStore()

// true = popover opens below the row, false = above
const popoverBelow = ref(false)

function toggleError() {
  if (!showError.value) {
    // Measure before opening: if row top < 220px from scroll parent top, open below
    const rect = rowEl.value?.getBoundingClientRect()
    const parentRect = rowEl.value?.closest('.queue-scroll')?.getBoundingClientRect()
    const topOffset = rect && parentRect ? rect.top - parentRect.top : (rect?.top ?? 300)
    popoverBelow.value = topOffset < 220
  }
  showError.value = !showError.value
}

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

const errorDetails = computed(() => {
  const raw = props.item.error || 'An unknown error occurred.'
  let fix = ''

  if (/unsupported url|no video formats/i.test(raw)) {
    fix = 'The URL may be private, geo-blocked, or not supported. Try a different source.'
  } else if (/sign.?in|login|age.?restricted|members.?only/i.test(raw)) {
    fix = 'This video requires a sign-in or is age-restricted. It cannot be downloaded.'
  } else if (/copyright|unavailable in your country/i.test(raw)) {
    fix = 'This video is blocked due to copyright or region restrictions.'
  } else if (/metadata fetch failed|failed to parse/i.test(raw)) {
    fix = 'Could not read video info. Check your internet connection or try again later.'
  } else if (/ffmpeg|convert/i.test(raw)) {
    fix = 'Audio conversion failed. Make sure FFmpeg is present in the resources folder.'
  } else if (/yt-dlp|spawn/i.test(raw)) {
    fix = 'yt-dlp could not be started. Make sure the yt-dlp binary is in the resources folder.'
  } else if (/output folder|ENOENT|permission/i.test(raw)) {
    fix = 'Could not write the file. Check that the output folder exists and is writable.'
  } else if (/network|ENOTFOUND|ETIMEDOUT/i.test(raw)) {
    fix = 'Network error. Check your internet connection and try again.'
  } else {
    fix = 'Try retrying the item. If it keeps failing, the source URL may no longer be available.'
  }

  return { raw, fix }
})
</script>

<template>
  <div
    ref="rowEl"
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

    <!-- Status badge — clickable when failed -->
    <StatusBadge
      :status="item.status"
      :clickable="item.status === 'failed'"
      @click.stop="item.status === 'failed' && toggleError()"
    />

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

    <!-- Error popover -->
    <Transition name="err">
      <div v-if="showError && item.status === 'failed'" class="error-popover" :class="{ below: popoverBelow }" @click.stop>
        <div class="err-header">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>Download failed</span>
          <button class="err-close" @click.stop="showError = false">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="err-body">
          <p class="err-fix">{{ errorDetails.fix }}</p>
          <details class="err-raw">
            <summary>Technical details</summary>
            <pre>{{ errorDetails.raw }}</pre>
          </details>
        </div>
        <div class="err-footer">
          <button class="err-btn" @click.stop="queueStore.addUrl(item.url); showError = false">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4v5h5M20 20v-5h-5"/><path d="M4.07 15a8 8 0 1014.07-8.36L20 4"/>
            </svg>
            Retry
          </button>
          <a class="err-btn ghost" :href="item.url" target="_blank" rel="noopener" @click.stop>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open URL
          </a>
          <button class="err-btn ghost" @click.stop="queueStore.removeItem(item.id)">Remove</button>
        </div>
      </div>
    </Transition>
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
.queue-row.hovered { background: var(--bg-2); border-left: 2px solid var(--accent); margin-left: -2px; }
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
  font-size: 11px;
  color: var(--tx-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'JetBrains Mono', monospace;
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

/* Error popover */
.error-popover {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 12px;
  z-index: 100;
}
.error-popover.below {
  bottom: auto;
  top: calc(100% + 6px);
}
.error-popover {
  width: 320px;
  background: var(--bg-1);
  border: 1px solid color-mix(in srgb, var(--bad) 40%, transparent);
  border-radius: calc(var(--radius) + 2px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  overflow: hidden;
}
.err-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--bad) 10%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--bad) 20%, transparent);
  color: var(--bad);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
}
.err-header span { flex: 1; }
.err-close {
  background: none; border: none; cursor: pointer;
  color: var(--bad); opacity: 0.6; padding: 2px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px;
}
.err-close:hover { opacity: 1; background: color-mix(in srgb, var(--bad) 15%, transparent); }
.err-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.err-fix { margin: 0; font-size: 12.5px; color: var(--tx-dim); line-height: 1.5; }
.err-raw {
  font-size: 11px;
  color: var(--tx-faint);
}
.err-raw summary {
  cursor: pointer;
  color: var(--tx-faint);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 600;
  user-select: none;
  margin-bottom: 4px;
}
.err-raw pre {
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--bad);
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--bg-2);
  padding: 8px;
  border-radius: 6px;
  max-height: 120px;
  overflow-y: auto;
}
.err-footer {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--line);
}
.err-btn {
  flex: 1; padding: 6px 10px; border-radius: 6px; border: none;
  background: var(--bad); color: #fff; font-size: 12px; font-weight: 600;
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;
  transition: opacity 0.12s;
}
.err-btn:hover { opacity: 0.85; }
.err-btn.ghost {
  background: transparent; color: var(--tx-dim);
  border: 1.5px solid var(--line-2); text-decoration: none;
}
.err-btn.ghost:hover { background: var(--bg-3); color: var(--tx); opacity: 1; }

.err-enter-active, .err-leave-active { transition: opacity 0.15s, transform 0.15s; }
.err-enter-from, .err-leave-to { opacity: 0; transform: translateY(4px); }
</style>
