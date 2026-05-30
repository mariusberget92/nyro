<script setup lang="ts">
import { ref, computed } from 'vue'
import type { QueueItem } from '@shared/types/queue'
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

const showError = ref(false)
const queueStore = useQueueStore()

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

const pillColor = computed(() => {
  switch (props.item.status) {
    case 'downloading': case 'fetching': return 'pill--active'
    case 'converting': case 'tagging': return 'pill--converting'
    case 'completed': return 'pill--done'
    case 'failed': case 'cancelled': return 'pill--failed'
    case 'paused': return 'pill--paused'
    default: return 'pill--pending'
  }
})

const pillLabel = computed(() => {
  switch (props.item.status) {
    case 'fetching': return 'Fetching'
    case 'downloading': return 'Downloading'
    case 'converting': return 'Converting'
    case 'tagging': return 'Tagging'
    case 'completed': return 'Done'
    case 'failed': return 'Failed'
    case 'cancelled': return 'Cancelled'
    case 'paused': return 'Paused'
    default: return 'Pending'
  }
})

const progressVisible = computed(() =>
  ['downloading', 'converting', 'tagging', 'completed'].includes(props.item.status)
)

const progressColor = computed(() => {
  if (props.item.status === 'converting' || props.item.status === 'tagging') return 'var(--conv)'
  if (props.item.status === 'completed') return 'var(--ok)'
  return 'var(--accent)'
})

const errorDetails = computed(() => {
  const raw = props.item.error || 'An unknown error occurred.'
  let fix = ''
  let hint = ''
  if (/could not copy.+cookie database|copy chrome cookie/i.test(raw)) {
    fix = 'Chrome is open and has locked its cookie database — yt-dlp cannot read it while Chrome is running.'
    hint = 'Fix: use Method A in Settings → YouTube Cookies. Export a cookies.txt with the "Get cookies.txt LOCALLY" extension and select the file.'
  } else if (/confirm you.re not a bot|not a bot/i.test(raw)) {
    fix = 'YouTube is blocking the download with bot-detection.'
    hint = 'Try retrying in a few minutes, or configure cookie auth in Settings → YouTube Cookies.'
  } else if (/age.?restricted|age.?gate/i.test(raw)) {
    fix = 'This video is age-restricted and requires a signed-in YouTube account.'
    hint = 'Configure cookie authentication in Settings → YouTube Cookies.'
  } else if (/members.?only|join.*channel/i.test(raw)) {
    fix = 'This video is for channel members only.'
  } else if (/sign.?in|login required/i.test(raw)) {
    fix = 'This video requires a YouTube sign-in to access.'
  } else if (/private video|this video is private/i.test(raw)) {
    fix = 'This video is private and cannot be downloaded.'
  } else if (/unsupported url|no video formats|unable to extract/i.test(raw)) {
    fix = 'The URL may not be supported or the video has no downloadable formats.'
  } else if (/copyright|unavailable in your country|blocked in/i.test(raw)) {
    fix = 'This video is blocked due to copyright or regional restrictions.'
  } else if (/ffmpeg|convert/i.test(raw)) {
    fix = 'Audio conversion failed. Make sure FFmpeg is present in the resources folder.'
  } else if (/yt-dlp|spawn/i.test(raw)) {
    fix = 'yt-dlp could not be started. Make sure the yt-dlp binary is in the resources folder.'
  } else if (/ENOENT|permission denied/i.test(raw)) {
    fix = 'Could not write the file. Check that the output folder exists and is writable.'
  } else if (/network|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(raw)) {
    fix = 'Network error. Check your internet connection and try again.'
  } else {
    fix = 'Try retrying. If it keeps failing, the video may no longer be available.'
  }
  return { raw, fix, hint }
})
</script>

<template>
  <div class="card" :class="{ 'card--selected': selected }" @click.stop="emit('toggleSelect', item.id)">
    <!-- Thumbnail -->
    <div class="card-thumb">
      <img v-if="thumbnailUrl" :src="thumbnailUrl" :alt="title" />
      <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" class="thumb-placeholder">
        <path d="M9 18V5l12-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/>
      </svg>

      <!-- Status pill top-left -->
      <span class="pill" :class="pillColor">{{ pillLabel }}</span>

      <!-- Heart top-right -->
      <button
        class="heart-btn"
        :class="{ 'heart-btn--liked': item.liked }"
        @click.stop="queueStore.toggleLike(item.id)"
        :title="item.liked ? 'Unlike' : 'Like'"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" :fill="item.liked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>

      <!-- Overlay actions (shown on hover via CSS) -->
      <div class="card-overlay">
        <button v-if="item.status === 'failed'" class="overlay-btn" title="Retry" @click.stop="queueStore.addUrl(item.url)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4v5h5M20 20v-5h-5"/><path d="M4.07 15a8 8 0 1014.07-8.36L20 4"/>
          </svg>
        </button>
        <button class="overlay-btn" title="Edit" @click.stop="emit('edit', item)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button v-if="item.status === 'failed'" class="overlay-btn overlay-btn--danger" title="Error details" @click.stop="showError = !showError">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </button>
        <button class="overlay-btn overlay-btn--danger" title="Remove" @click.stop="queueStore.removeItem(item.id)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
        </button>
      </div>

      <!-- Progress bar bottom of thumb -->
      <div v-if="progressVisible" class="thumb-progress">
        <div class="thumb-progress-fill" :style="{ width: `${item.progress || 0}%`, background: progressColor }" />
      </div>
    </div>

    <!-- Card body -->
    <div class="card-body">
      <p class="card-title">{{ title }}</p>
      <p v-if="artist" class="card-artist">{{ artist }}</p>
      <span v-if="duration" class="card-duration">{{ duration }}</span>
    </div>

    <!-- Error popover -->
    <Transition name="err">
      <div v-if="showError && item.status === 'failed'" class="error-popover" @click.stop>
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
          <p v-if="errorDetails.hint" class="err-hint">{{ errorDetails.hint }}</p>
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
/* ── Card ─────────────────────────────────────────────── */
.card {
  position: relative;
  border-radius: 12px;
  background: var(--bg-1);
  border: 1px solid var(--line);
  overflow: visible;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.card:hover {
  border-color: var(--line-2);
  box-shadow: 0 4px 20px rgba(0,0,0,0.35);
}
.card--selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

/* ── Thumbnail (1:1 ratio) ────────────────────────────── */
.card-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--bg-3);
  border-radius: 11px 11px 0 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb-placeholder { color: var(--tx-faint); }

/* ── Status pill ──────────────────────────────────────── */
.pill {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  font-family: 'JetBrains Mono', monospace;
  backdrop-filter: blur(6px);
  pointer-events: none;
}
.pill--pending   { background: rgba(0,0,0,0.55); color: var(--tx-faint); }
.pill--active    { background: color-mix(in srgb, var(--accent) 25%, rgba(0,0,0,0.55)); color: var(--accent); }
.pill--converting{ background: color-mix(in srgb, var(--conv) 25%, rgba(0,0,0,0.55)); color: var(--conv); }
.pill--done      { background: color-mix(in srgb, var(--ok) 25%, rgba(0,0,0,0.55)); color: var(--ok); }
.pill--failed    { background: color-mix(in srgb, var(--bad) 25%, rgba(0,0,0,0.55)); color: var(--bad); }
.pill--paused    { background: color-mix(in srgb, var(--warn) 25%, rgba(0,0,0,0.55)); color: var(--warn); }

/* ── Heart button ─────────────────────────────────────── */
.heart-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(6px);
  color: var(--tx-faint);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.15s, background 0.15s, transform 0.1s;
  z-index: 2;
}
.heart-btn:hover { color: #e06c75; background: rgba(0,0,0,0.7); }
.heart-btn--liked { color: #e06c75; }
.heart-btn--liked:hover { transform: scale(1.15); }

/* ── Hover overlay with action buttons ───────────────── */
.card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.15s;
}
.card-thumb:hover .card-overlay { opacity: 1; }
.overlay-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.12);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s, transform 0.1s;
}
.overlay-btn:hover { background: rgba(255,255,255,0.22); transform: scale(1.08); }
.overlay-btn--danger:hover { background: color-mix(in srgb, var(--bad) 50%, rgba(0,0,0,0.3)); }

/* ── Progress bar bottom of thumbnail ────────────────── */
.thumb-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255,255,255,0.1);
}
.thumb-progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

/* ── Card body ────────────────────────────────────────── */
.card-body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.card-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--tx);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.35;
}
.card-artist {
  margin: 0;
  font-size: 11px;
  color: var(--tx-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'JetBrains Mono', monospace;
}
.card-duration {
  font-size: 10px;
  color: var(--tx-faint);
  font-family: 'JetBrains Mono', monospace;
  margin-top: 2px;
}

/* ── Error popover ────────────────────────────────────── */
.error-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 100;
  width: 300px;
  background: var(--bg-1);
  border: 1px solid color-mix(in srgb, var(--bad) 40%, transparent);
  border-radius: 10px;
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
  display: flex; align-items: center; justify-content: center; border-radius: 4px;
}
.err-close:hover { opacity: 1; background: color-mix(in srgb, var(--bad) 15%, transparent); }
.err-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.err-fix  { margin: 0; font-size: 12.5px; color: var(--tx-dim); line-height: 1.5; }
.err-hint { margin: 0; font-size: 11.5px; color: var(--tx-faint); line-height: 1.5; }
.err-raw { font-size: 11px; color: var(--tx-faint); }
.err-raw summary {
  cursor: pointer; color: var(--tx-faint); font-size: 10.5px;
  letter-spacing: 0.04em; text-transform: uppercase; font-weight: 600;
  user-select: none; margin-bottom: 4px;
}
.err-raw pre {
  margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: var(--bad); white-space: pre-wrap; word-break: break-all;
  background: var(--bg-2); padding: 8px; border-radius: 6px;
  max-height: 100px; overflow-y: auto;
}
.err-footer {
  display: flex; gap: 6px; padding: 10px 12px;
  border-top: 1px solid var(--line);
}
.err-btn {
  flex: 1; padding: 6px 10px; border-radius: 6px; border: none;
  background: var(--bad); color: #fff; font-size: 12px; font-weight: 600;
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;
  transition: opacity 0.12s; text-decoration: none;
}
.err-btn:hover { opacity: 0.85; }
.err-btn.ghost {
  background: transparent; color: var(--tx-dim);
  border: 1.5px solid var(--line-2);
}
.err-btn.ghost:hover { background: var(--bg-3); color: var(--tx); opacity: 1; }

.err-enter-active, .err-leave-active { transition: opacity 0.15s, transform 0.15s; }
.err-enter-from, .err-leave-to { opacity: 0; transform: translateY(4px); }
</style>
