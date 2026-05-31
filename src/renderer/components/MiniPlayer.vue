<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { usePlayerStore } from '../stores/playerStore'
import { useHistoryStore } from '../stores/historyStore'
import AudioProcessor from './AudioProcessor.vue'
import Visualizer from './Visualizer.vue'
import { connectAudioElement, resumeContext } from '../composables/audioEngine'

const player = usePlayerStore()
const history = useHistoryStore()
const audio = ref<HTMLAudioElement | null>(null)
const showSleepPicker = ref(false)
const showEq = ref(false)
const showSpeedPicker = ref(false)
let audioConnected = false
const sleepCustomMin = ref(30)

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const speedLabel = computed(() => player.speed === 1 ? '1×' : `${player.speed}×`)

// Sleep timer display — remaining time as "Xh Ym" or "Xm"
const sleepRemaining = computed(() => {
  if (!player.sleepEndsAt) return null
  const diff = Math.max(0, player.sleepEndsAt - Date.now())
  const total = Math.ceil(diff / 60000)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
})

let sleepTick: ReturnType<typeof setInterval> | null = null
const lyricsPanel = ref<HTMLElement | null>(null)
const activeLine  = ref<HTMLElement | null>(null)

const coverStyle = computed(() => {
  const t = player.currentTrack
  if (!t?.coverPath) return {}
  const url = `nyro-file://local?p=${encodeURIComponent(t.coverPath)}`
  return { backgroundImage: `url("${url}")` }
})

const progressPct = computed(() => `${player.progress * 100}%`)

const timeStr = (sec: number) => {
  const s = Math.floor(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function scrub(e: MouseEvent) {
  if (!audio.value || !player.duration) return
  const el = e.currentTarget as HTMLElement
  const ratio = Math.max(0, Math.min(1, e.offsetX / el.clientWidth))
  audio.value.currentTime = ratio * player.duration
  player.setProgress(ratio)
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

watch(() => player.speed, (rate) => {
  if (!audio.value) return
  audio.value.playbackRate = rate
  audio.value.preservesPitch = true
})

// Explicit seek requests from store actions (prev restart, etc.)
watch(() => player.pendingSeek, (t) => {
  if (t === null || !audio.value) return
  audio.value.currentTime = t
  player.consumeSeek()
}, { flush: 'post' })

function onTimeUpdate() {
  if (!audio.value || player.duration === 0) return
  player.setProgress(audio.value.currentTime / player.duration)
}

function onLoadedMetadata() {
  if (!audio.value) return
  player.setDuration(audio.value.duration)
  audio.value.playbackRate = player.speed
  audio.value.preservesPitch = true
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
  sleepTick = setInterval(() => player.tickSleepTimer(), 5000)
})

// Connect the audio element to the Web Audio engine on first play interaction
watch(() => player.playing, (playing) => {
  if (playing && audio.value && !audioConnected) {
    connectAudioElement(audio.value)
    audioConnected = true
  }
  if (playing) resumeContext()
}, { flush: 'post' })

// System notification + play history on track change
let lastNotifiedPath = ''
watch(() => player.currentTrack, (track) => {
  if (!track || track.path === lastNotifiedPath) return
  lastNotifiedPath = track.path
  history.record(track)
  if (Notification.permission === 'granted') {
    const n = new Notification(track.title || 'Now Playing', {
      body: track.artist || track.album || '',
      icon: track.coverPath ? `nyro-file://local?p=${encodeURIComponent(track.coverPath)}` : undefined,
      silent: true,
    })
    setTimeout(() => n.close(), 4000)
  } else if (Notification.permission === 'default') {
    Notification.requestPermission()
  }
})

onBeforeUnmount(() => {
  audio.value?.pause()
  if (sleepTick) clearInterval(sleepTick)
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

    <!-- EQ / Compressor panel (slides up) -->
    <Transition name="lyrics-slide">
      <AudioProcessor v-if="showEq" />
    </Transition>

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

    <!-- Spectrum visualizer -->
    <Visualizer :playing="player.playing" />

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

        <!-- EQ -->
        <button class="ctrl-btn" :class="{ active: showEq }" title="Equalizer / Compressor" @click="showEq = !showEq">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <line x1="4"  y1="21" x2="4"  y2="14"/><line x1="4"  y1="10" x2="4"  y2="3"/>
            <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8"  x2="12" y2="3"/>
            <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
            <line x1="1"  y1="14" x2="7"  y2="14"/>
            <line x1="9"  y1="8"  x2="15" y2="8"/>
            <line x1="17" y1="16" x2="23" y2="16"/>
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

      <!-- Time + Volume + Sleep -->
      <div class="right-section">
        <div class="top-row">
          <span class="time-label">
            {{ timeStr(player.progress * player.duration) }} / {{ timeStr(player.duration) }}
          </span>

          <!-- Speed picker -->
          <div class="speed-wrap">
            <button
              class="ctrl-btn speed-btn"
              :class="{ active: player.speed !== 1 }"
              :title="`Playback speed: ${speedLabel}`"
              @click.stop="showSpeedPicker = !showSpeedPicker"
            >{{ speedLabel }}</button>
            <Transition name="pop">
              <div v-if="showSpeedPicker" class="speed-popover" @click.stop>
                <div class="speed-popover-title">Playback speed</div>
                <div class="speed-options">
                  <button
                    v-for="s in SPEEDS" :key="s"
                    class="speed-opt"
                    :class="{ active: player.speed === s }"
                    @click="player.setSpeed(s); showSpeedPicker = false"
                  >{{ s === 1 ? '1× Normal' : `${s}×` }}</button>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Sleep timer button -->
          <div class="sleep-wrap">
            <button
              class="ctrl-btn sleep-btn"
              :class="{ active: !!player.sleepEndsAt }"
              :title="player.sleepEndsAt ? `Sleep in ${sleepRemaining}` : 'Sleep timer'"
              @click.stop="showSleepPicker = !showSleepPicker"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              <span v-if="sleepRemaining" class="sleep-label">{{ sleepRemaining }}</span>
            </button>

            <!-- Sleep picker popover -->
            <Transition name="pop">
              <div v-if="showSleepPicker" class="sleep-popover" @click.stop>
                <div class="sleep-popover-title">Sleep timer</div>
                <div class="sleep-presets">
                  <button v-for="m in [15, 30, 45, 60, 90, 120]" :key="m"
                    class="sleep-preset"
                    :class="{ active: player.sleepEndsAt && Math.round((player.sleepEndsAt - Date.now()) / 60000) === m }"
                    @click="player.setSleepTimer(m); showSleepPicker = false"
                  >{{ m >= 60 ? `${m/60}h` : `${m}m` }}</button>
                </div>
                <div class="sleep-custom-row">
                  <input v-model.number="sleepCustomMin" type="number" min="1" max="480" class="sleep-custom-input" />
                  <span class="sleep-custom-unit">min</span>
                  <button class="sleep-set-btn" @click="player.setSleepTimer(sleepCustomMin); showSleepPicker = false">Set</button>
                </div>
                <button v-if="player.sleepEndsAt" class="sleep-cancel-btn" @click="player.clearSleepTimer(); showSleepPicker = false">
                  Cancel timer
                </button>
              </div>
            </Transition>
          </div>
        </div>

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
  background: var(--bg-1);
  border-top: 1px solid var(--line);
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
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--accent);
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
  width: 34px; height: 34px; border: none;
  background: var(--accent); color: var(--bg-0);
  border-radius: 50%; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: opacity 0.12s;
}
.play-btn:hover { opacity: 0.85; }

/* ── Right ──────────────────────────────── */
.right-section {
  display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
  width: 200px; flex-shrink: 0;
}
.top-row {
  display: flex; align-items: center; gap: 8px; justify-content: flex-end; width: 100%;
}
.time-label {
  font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--tx-faint);
}
.volume-row {
  display: flex; align-items: center; gap: 5px; color: var(--tx-faint);
}

/* ── Speed picker ─────────────────────── */
.speed-wrap { position: relative; }
.speed-btn {
  width: auto; padding: 0 7px;
  font-size: 10px; font-family: 'JetBrains Mono', monospace; font-weight: 700;
}
.speed-popover {
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  width: 150px;
  background: var(--bg-1);
  border: 1px solid var(--line-2);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.55);
  display: flex; flex-direction: column; gap: 8px;
  z-index: 200;
}
.speed-popover-title {
  font-size: 10px; font-weight: 700; color: var(--tx-dim);
  text-transform: uppercase; letter-spacing: 0.07em;
}
.speed-options { display: flex; flex-direction: column; gap: 3px; }
.speed-opt {
  padding: 5px 8px; border-radius: 7px; border: 1px solid transparent;
  background: transparent; color: var(--tx-dim); font-size: 12px;
  font-weight: 500; cursor: pointer; text-align: left;
  transition: background 0.1s, color 0.1s;
}
.speed-opt:hover { background: var(--bg-3); color: var(--tx); }
.speed-opt.active { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); background: color-mix(in srgb, var(--accent) 10%, transparent); }

/* ── Sleep timer ──────────────────────── */
.sleep-wrap { position: relative; }
.sleep-btn {
  display: flex; align-items: center; gap: 4px;
  width: auto; padding: 0 6px;
}
.sleep-label {
  font-size: 9px; font-family: 'JetBrains Mono', monospace;
  color: var(--accent); white-space: nowrap;
}
.sleep-popover {
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  width: 220px;
  background: var(--bg-1);
  border: 1px solid var(--line-2);
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.55);
  display: flex; flex-direction: column; gap: 10px;
  z-index: 200;
}
.sleep-popover-title {
  font-size: 11px; font-weight: 700; color: var(--tx-dim);
  text-transform: uppercase; letter-spacing: 0.07em;
}
.sleep-presets {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
}
.sleep-preset {
  padding: 5px 0; border-radius: 7px; border: 1px solid var(--line-2);
  background: var(--bg-2); color: var(--tx-dim); font-size: 12px;
  font-weight: 600; cursor: pointer; text-align: center;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.sleep-preset:hover { background: var(--bg-3); color: var(--tx); }
.sleep-preset.active { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); border-color: var(--accent); }
.sleep-custom-row {
  display: flex; align-items: center; gap: 6px;
}
.sleep-custom-input {
  width: 60px; background: var(--bg-2); border: 1px solid var(--line-2);
  border-radius: 6px; color: var(--tx); font-size: 12px; padding: 4px 7px;
  outline: none; text-align: center;
}
.sleep-custom-input:focus { border-color: var(--accent); }
.sleep-custom-unit { font-size: 11px; color: var(--tx-faint); flex: 1; }
.sleep-set-btn {
  padding: 4px 12px; border-radius: 6px; border: none;
  background: var(--accent); color: var(--bg-0);
  font-size: 11px; font-weight: 700; cursor: pointer;
  transition: opacity 0.12s;
}
.sleep-set-btn:hover { opacity: 0.85; }
.sleep-cancel-btn {
  padding: 5px 0; border-radius: 7px; border: 1px solid color-mix(in srgb, var(--bad) 40%, transparent);
  background: color-mix(in srgb, var(--bad) 10%, transparent); color: var(--bad);
  font-size: 11px; font-weight: 600; cursor: pointer; text-align: center;
  transition: background 0.12s;
}
.sleep-cancel-btn:hover { background: color-mix(in srgb, var(--bad) 20%, transparent); }
.pop-enter-active, .pop-leave-active { transition: opacity 0.15s, transform 0.15s; }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: translateY(6px) scale(0.97); }
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
  background: var(--bg-1);
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
