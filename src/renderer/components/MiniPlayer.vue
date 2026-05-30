<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { usePlayerStore } from '../stores/playerStore'

const player = usePlayerStore()
const audio = ref<HTMLAudioElement | null>(null)
const lyricsPanel = ref<HTMLElement | null>(null)
const activeLine  = ref<HTMLElement | null>(null)

const coverStyle = computed(() => {
  const t = player.currentTrack
  if (!t?.coverPath) return {}
  const url = `nyro-file://${encodeURIComponent(t.coverPath.replace(/\\/g, '/'))}`
  return { backgroundImage: `url("${url}")` }
})

const progressPct = computed(() => `${player.progress * 100}%`)

const timeStr = (sec: number) => {
  const s = Math.floor(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function scrub(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const ratio = e.offsetX / el.clientWidth
  player.setProgress(ratio)
  if (audio.value) audio.value.currentTime = ratio * player.duration
}

// Sync audio element with store — flush:'post' ensures audio.value is assigned
watch(() => player.audioUrl, (url) => {
  if (!audio.value || !url) return
  audio.value.src = url
  if (player.playing) audio.value.play().catch(() => {})
}, { immediate: true, flush: 'post' })

watch(() => player.playing, (playing) => {
  if (!audio.value) return
  if (playing) audio.value.play().catch(() => {})
  else audio.value.pause()
}, { flush: 'post' })

watch(() => player.volume, (v) => {
  if (audio.value) audio.value.volume = v
})

watch(() => player.progress, (p) => {
  if (!audio.value || player.duration === 0) return
  const expected = p * player.duration
  if (Math.abs(audio.value.currentTime - expected) > 1.5) {
    audio.value.currentTime = expected
  }
})

function onTimeUpdate() {
  if (!audio.value || player.duration === 0) return
  player.setProgress(audio.value.currentTime / player.duration)
}

function onLoadedMetadata() {
  if (!audio.value) return
  player.setDuration(audio.value.duration)
  if (player.playing) audio.value.play().catch(() => {})
}

function onEnded() {
  player.next()
}

// Auto-scroll lyrics to active line
watch(() => (player as any).currentLyricIndex, () => {
  nextTick(() => {
    activeLine.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
})

onMounted(() => {
  if (audio.value) audio.value.volume = player.volume
})

onBeforeUnmount(() => {
  audio.value?.pause()
})
</script>

<template>
  <div v-if="player.currentTrack" class="mini-player">
    <audio
      ref="audio"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @ended="onEnded"
    />

    <!-- Lyrics panel (slides up) -->
    <Transition name="lyrics-slide">
      <div v-if="player.showLyrics" ref="lyricsPanel" class="lyrics-panel">
        <div v-if="(player as any).lrcLines?.length" class="lyrics-lines">
          <div
            v-for="(line, i) in (player as any).lrcLines"
            :key="i"
            :ref="el => { if (i === (player as any).currentLyricIndex) activeLine = el as HTMLElement }"
            class="lyric-line"
            :class="{ active: i === (player as any).currentLyricIndex, past: i < (player as any).currentLyricIndex }"
          >{{ line.text }}</div>
        </div>
        <div v-else-if="player.lrcRaw" class="lyrics-plain">{{ player.lrcRaw }}</div>
        <div v-else class="lyrics-empty">No lyrics available for this track.</div>
      </div>
    </Transition>

    <!-- Scrub bar -->
    <div class="scrub-track" @click="scrub">
      <div class="scrub-fill" :style="{ width: progressPct }" />
      <div class="scrub-thumb" :style="{ left: progressPct }" />
    </div>

    <div class="player-body">
      <!-- Cover + info -->
      <div class="track-info">
        <div class="cover" :style="coverStyle">
          <svg v-if="!player.currentTrack.coverPath" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 18V5l12-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/>
          </svg>
        </div>
        <div class="track-text">
          <span class="track-title">{{ player.currentTrack.title }}</span>
          <span class="track-artist">{{ player.currentTrack.artist }}</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls">
        <!-- Shuffle -->
        <button class="ctrl-btn" :class="{ active: player.shuffle }" title="Shuffle" @click="player.toggleShuffle()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="16 3 21 3 21 8"/>
            <line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="21 16 21 21 16 21"/>
            <line x1="15" y1="15" x2="21" y2="21"/>
          </svg>
        </button>

        <!-- Prev -->
        <button class="ctrl-btn" title="Previous" @click="player.prev()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="19 20 9 12 19 4 19 20"/>
            <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>

        <!-- Play / Pause -->
        <button class="play-btn" @click="player.togglePlay()">
          <svg v-if="!player.playing" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
          </svg>
        </button>

        <!-- Next -->
        <button class="ctrl-btn" title="Next" @click="player.next()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 4 15 12 5 20 5 4"/>
            <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>

        <!-- Lyrics -->
        <button
          class="ctrl-btn"
          :class="{ active: player.showLyrics }"
          :title="player.currentTrack?.lrcPath ? 'Lyrics' : 'No lyrics available'"
          :style="{ opacity: player.currentTrack?.lrcPath ? 1 : 0.35 }"
          @click="player.currentTrack?.lrcPath && player.toggleLyrics()"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </button>

        <!-- Repeat -->
        <button class="ctrl-btn" :class="{ active: player.repeat !== 'off' }" title="Repeat" @click="player.cycleRepeat()">
          <svg v-if="player.repeat !== 'one'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 014-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 01-4 4H3"/>
          </svg>
          <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 014-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 01-4 4H3"/>
            <line x1="12" y1="8" x2="12" y2="16" stroke-width="2.5"/>
          </svg>
        </button>
      </div>

      <!-- Time + Volume -->
      <div class="right-section">
        <span class="time-label">
          {{ timeStr(player.progress * player.duration) }} / {{ timeStr(player.duration) }}
        </span>
        <div class="volume-row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path v-if="player.volume > 0.5" d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
            <path v-else-if="player.volume > 0" d="M15.54 8.46a5 5 0 010 7.07"/>
          </svg>
          <input
            type="range" min="0" max="1" step="0.02"
            :value="player.volume"
            class="vol-slider"
            @input="player.setVolume(+($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mini-player {
  flex-shrink: 0;
  background: linear-gradient(to top, var(--bg-1), var(--bg-0));
  border-top: 1px solid var(--line-2);
  display: flex;
  flex-direction: column;
}

/* ── Scrub bar ──────────────────────────── */
.scrub-track {
  position: relative;
  height: 3px;
  background: var(--bg-3);
  cursor: pointer;
  transition: height 0.1s;
}
.scrub-track:hover { height: 5px; }
.scrub-fill {
  position: absolute; top: 0; left: 0; height: 100%;
  background: var(--accent);
  transition: width 0.1s linear;
  pointer-events: none;
}
.scrub-thumb {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.1s;
}
.scrub-track:hover .scrub-thumb { opacity: 1; }

/* ── Body ───────────────────────────────── */
.player-body {
  display: flex;
  align-items: center;
  height: 60px;
  padding: 0 16px;
  gap: 16px;
}

/* ── Track info ─────────────────────────── */
.track-info {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 220px;
  flex-shrink: 0;
  min-width: 0;
}
.cover {
  width: 38px; height: 38px; flex-shrink: 0;
  border-radius: 6px;
  background: var(--bg-3) center/cover no-repeat;
  display: flex; align-items: center; justify-content: center;
  color: var(--tx-faint);
}
.track-text {
  display: flex; flex-direction: column; gap: 2px; min-width: 0;
}
.track-title {
  font-size: 12.5px; font-weight: 600; color: var(--tx);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.track-artist {
  font-size: 11px; color: var(--tx-faint);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ── Controls ───────────────────────────── */
.controls {
  display: flex; align-items: center; gap: 4px; flex: 1; justify-content: center;
}
.ctrl-btn {
  width: 30px; height: 30px; border: none; background: transparent;
  color: var(--tx-faint); cursor: pointer; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.12s, background 0.12s;
}
.ctrl-btn:hover { color: var(--tx-dim); background: var(--bg-3); }
.ctrl-btn.active { color: var(--accent); }
.play-btn {
  width: 36px; height: 36px; border: none;
  background: var(--accent); color: var(--bg-0);
  border-radius: 50%; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: box-shadow 0.15s, transform 0.1s;
  box-shadow: 0 0 12px var(--accent-glow);
}
.play-btn:hover { box-shadow: 0 0 20px var(--accent-glow-strong); transform: scale(1.06); }

/* ── Right ──────────────────────────────── */
.right-section {
  display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
  width: 160px; flex-shrink: 0;
}
.time-label {
  font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--tx-faint);
}
.volume-row {
  display: flex; align-items: center; gap: 5px; color: var(--tx-faint);
}
.vol-slider {
  -webkit-appearance: none; width: 72px; height: 3px;
  background: var(--bg-3); border-radius: 2px; cursor: pointer; outline: none;
}
.vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 11px; height: 11px;
  border-radius: 50%; background: var(--accent); cursor: pointer;
}

/* ── Lyrics panel ──────────────────────────────── */
.lyrics-panel {
  max-height: 220px;
  overflow-y: auto;
  background: linear-gradient(to bottom, var(--bg-0), var(--bg-1));
  border-top: 1px solid var(--line);
  padding: 16px 0 12px;
  text-align: center;
}
.lyrics-lines {
  display: flex; flex-direction: column; gap: 8px;
  padding: 0 60px;
}
.lyric-line {
  font-size: 14px; line-height: 1.6;
  color: var(--tx-faint);
  transition: color 0.3s, transform 0.3s, font-size 0.3s;
}
.lyric-line.past  { color: var(--tx-faint); }
.lyric-line.active {
  color: var(--tx);
  font-size: 16px;
  font-weight: 700;
  text-shadow: 0 0 20px var(--accent-glow-strong);
}
.lyrics-plain {
  padding: 0 60px; font-size: 13px; line-height: 1.8;
  color: var(--tx-dim); white-space: pre-wrap; text-align: left;
}
.lyrics-empty {
  font-size: 12px; color: var(--tx-faint); padding: 8px 0;
}

.lyrics-slide-enter-active, .lyrics-slide-leave-active {
  transition: max-height 0.25s ease, opacity 0.2s;
}
.lyrics-slide-enter-from, .lyrics-slide-leave-to {
  max-height: 0; opacity: 0;
}
</style>
