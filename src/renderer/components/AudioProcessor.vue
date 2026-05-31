<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  EQ_BANDS, MB_BANDS,
  eqSettings, mbSettings,
  setEqGain, applyEqEnabled, applyMbEnabled, applyPreamp,
  setMbParam, getEqResponse, getFreqArray_public,
} from '../composables/audioEngine'

const tab = ref<'eq' | 'mb'>('eq')
const canvas = ref<HTMLCanvasElement | null>(null)
let animFrame = 0

// ── EQ dragging ──────────────────────────────────────────────────────────────
const dragging = ref<number | null>(null)
const dragStartY = ref(0)
const dragStartGain = ref(0)

const EQ_MIN = -12
const EQ_MAX = 12

function startDrag(e: PointerEvent, band: number) {
  dragging.value = band
  dragStartY.value = e.clientY
  dragStartGain.value = eqSettings.gains[band]
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', stopDrag)
  e.currentTarget instanceof Element && (e.currentTarget as Element).setPointerCapture(e.pointerId)
}

function onDrag(e: PointerEvent) {
  if (dragging.value === null) return
  const dy = dragStartY.value - e.clientY   // up = positive gain
  const delta = (dy / 80) * (EQ_MAX - EQ_MIN)
  const clamped = Math.max(EQ_MIN, Math.min(EQ_MAX, dragStartGain.value + delta))
  setEqGain(dragging.value, Math.round(clamped * 10) / 10)
}

function stopDrag() {
  dragging.value = null
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', stopDrag)
}

function dblClickReset(band: number) {
  setEqGain(band, 0)
}

function gainPct(gain: number): number {
  return 50 - (gain / EQ_MAX) * 50   // 50% = 0dB; 0% = +12dB; 100% = -12dB
}

// ── Canvas frequency response ────────────────────────────────────────────────
function drawCurve() {
  const c = canvas.value
  if (!c) return
  const W = c.width = c.offsetWidth
  const H = c.height = c.offsetHeight
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, W, H)

  const freqs    = getFreqArray_public()
  const response = getEqResponse()
  const N        = freqs.length

  // Grid lines: dB
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth   = 1
  for (const db of [-12, -9, -6, -3, 0, 3, 6, 9, 12]) {
    const y = H / 2 - (db / 12) * (H / 2) * 0.9
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  // Grid lines: freq
  for (const f of [100, 1000, 10000]) {
    const x = Math.log10(f / 20) / Math.log10(20000 / 20) * W
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }

  // 0dB centre line
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth   = 1
  const midY = H / 2
  ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke()

  if (!eqSettings.enabled) {
    // When disabled, draw a flat line at 0dB
    ctx.strokeStyle = 'rgba(136,192,208,0.3)'
    ctx.lineWidth   = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke()
    ctx.setLineDash([])
    return
  }

  // Response curve fill
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0,   'rgba(136,192,208,0.35)')
  grad.addColorStop(0.5, 'rgba(136,192,208,0.08)')
  grad.addColorStop(1,   'rgba(136,192,208,0.0)')

  ctx.beginPath()
  for (let i = 0; i < N; i++) {
    const x   = Math.log10(freqs[i] / 20) / Math.log10(20000 / 20) * W
    const db  = 20 * Math.log10(Math.max(1e-6, response[i]))
    const y   = H / 2 - (db / 12) * (H / 2) * 0.9
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  // Close the fill path
  ctx.lineTo(W, H / 2)
  ctx.lineTo(0, H / 2)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  // Curve line
  ctx.beginPath()
  for (let i = 0; i < N; i++) {
    const x  = Math.log10(freqs[i] / 20) / Math.log10(20000 / 20) * W
    const db = 20 * Math.log10(Math.max(1e-6, response[i]))
    const y  = H / 2 - (db / 12) * (H / 2) * 0.9
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.strokeStyle = 'var(--accent)'
  ctx.lineWidth   = 1.8
  ctx.stroke()
}

function scheduleRedraw() {
  cancelAnimationFrame(animFrame)
  animFrame = requestAnimationFrame(drawCurve)
}

watch(() => [...eqSettings.gains, eqSettings.preampGain, eqSettings.enabled], scheduleRedraw)

onMounted(() => {
  nextTick(drawCurve)
  window.addEventListener('resize', scheduleRedraw)
})
onUnmounted(() => {
  cancelAnimationFrame(animFrame)
  window.removeEventListener('resize', scheduleRedraw)
})

// ── Compressor display helpers ────────────────────────────────────────────────
function ratioLabel(r: number) {
  return r >= 20 ? '∞:1' : `${r}:1`
}
</script>

<template>
  <div class="audio-processor">

    <!-- Tabs + master toggles -->
    <div class="ap-header">
      <div class="ap-tabs">
        <button :class="{ active: tab === 'eq' }" @click="tab = 'eq'">EQ</button>
        <button :class="{ active: tab === 'mb' }" @click="tab = 'mb'">Compressor</button>
      </div>

      <div class="ap-master">
        <label v-if="tab === 'eq'" class="toggle-label">
          <span>EQ</span>
          <button
            class="toggle-btn" :class="{ on: eqSettings.enabled }"
            @click="eqSettings.enabled = !eqSettings.enabled; applyEqEnabled()"
          >{{ eqSettings.enabled ? 'ON' : 'OFF' }}</button>
        </label>
        <label v-else class="toggle-label">
          <span>Compressor</span>
          <button
            class="toggle-btn" :class="{ on: mbSettings.enabled }"
            @click="mbSettings.enabled = !mbSettings.enabled; applyMbEnabled()"
          >{{ mbSettings.enabled ? 'ON' : 'OFF' }}</button>
        </label>
      </div>
    </div>

    <!-- ── EQ tab ─────────────────────────────────────────────────────── -->
    <div v-if="tab === 'eq'" class="eq-panel" :class="{ disabled: !eqSettings.enabled }">

      <!-- Frequency response canvas -->
      <div class="curve-wrap">
        <canvas ref="canvas" class="curve-canvas" />
        <!-- Freq labels -->
        <div class="freq-labels">
          <span>20</span><span>100</span><span>1k</span><span>10k</span><span>20k</span>
        </div>
        <!-- dB labels -->
        <div class="db-labels">
          <span>+12</span><span>+6</span><span>0</span><span>-6</span><span>-12</span>
        </div>
      </div>

      <!-- Band sliders -->
      <div class="eq-bands">
        <div
          v-for="(def, i) in EQ_BANDS" :key="def.freq"
          class="eq-band"
          :class="{ dragging: dragging === i }"
        >
          <div class="slider-track" @dblclick="dblClickReset(i)">
            <!-- Coloured fill from centre to handle -->
            <div class="slider-center-line" />
            <div
              class="slider-fill"
              :style="{
                top:    eqSettings.gains[i] >= 0 ? `${gainPct(eqSettings.gains[i])}%` : '50%',
                height: `${Math.abs(eqSettings.gains[i]) / EQ_MAX * 50}%`,
                background: eqSettings.gains[i] >= 0 ? 'var(--accent)' : 'var(--bad)',
              }"
            />
            <!-- Handle -->
            <div
              class="slider-handle"
              :style="{ top: `${gainPct(eqSettings.gains[i])}%` }"
              @pointerdown="startDrag($event, i)"
            />
          </div>
          <span class="band-label">{{ def.label }}</span>
          <span class="band-gain" :class="{ zero: eqSettings.gains[i] === 0 }">
            {{ eqSettings.gains[i] > 0 ? '+' : '' }}{{ eqSettings.gains[i].toFixed(1) }}
          </span>
        </div>
      </div>

      <!-- Preamp -->
      <div class="preamp-row">
        <span class="preamp-label">Preamp</span>
        <input
          type="range" class="preamp-slider"
          :min="EQ_MIN" :max="EQ_MAX" step="0.5"
          v-model.number="eqSettings.preampGain"
          @input="applyPreamp()"
        />
        <span class="preamp-val">{{ eqSettings.preampGain > 0 ? '+' : '' }}{{ eqSettings.preampGain.toFixed(1) }} dB</span>
        <button class="reset-btn" @click="eqSettings.preampGain = 0; applyPreamp()">Reset</button>
        <button class="reset-btn" @click="EQ_BANDS.forEach((_, i) => setEqGain(i, 0)); eqSettings.preampGain = 0; applyPreamp()">Flat</button>
      </div>

    </div>

    <!-- ── Compressor tab ──────────────────────────────────────────────── -->
    <div v-else class="mb-panel" :class="{ disabled: !mbSettings.enabled }">
      <div v-for="(def, i) in MB_BANDS" :key="def.label" class="mb-band">

        <div class="mb-band-header">
          <span class="mb-color-dot" :style="{ background: def.color }" />
          <span class="mb-band-label">{{ def.label }}</span>
          <span class="mb-band-range">
            {{ def.crossLow ? `${def.crossLow >= 1000 ? def.crossLow/1000+'k' : def.crossLow}Hz` : '20Hz' }}
            –
            {{ def.crossHigh ? `${def.crossHigh >= 1000 ? def.crossHigh/1000+'k' : def.crossHigh}Hz` : '20kHz' }}
          </span>
          <button
            class="mb-enable-btn" :class="{ on: mbSettings.bands[i].enabled }"
            @click="setMbParam(i, 'enabled', !mbSettings.bands[i].enabled)"
          >{{ mbSettings.bands[i].enabled ? 'ON' : 'OFF' }}</button>
        </div>

        <div class="mb-controls" :class="{ muted: !mbSettings.bands[i].enabled }">

          <div class="mb-param">
            <label>Threshold</label>
            <input type="range" min="-60" max="0" step="1"
              :value="mbSettings.bands[i].threshold"
              @input="setMbParam(i, 'threshold', +($event.target as HTMLInputElement).value)" />
            <span>{{ mbSettings.bands[i].threshold }} dB</span>
          </div>

          <div class="mb-param">
            <label>Ratio</label>
            <input type="range" min="1" max="20" step="0.5"
              :value="mbSettings.bands[i].ratio"
              @input="setMbParam(i, 'ratio', +($event.target as HTMLInputElement).value)" />
            <span>{{ ratioLabel(mbSettings.bands[i].ratio) }}</span>
          </div>

          <div class="mb-param">
            <label>Attack</label>
            <input type="range" min="0" max="200" step="1"
              :value="mbSettings.bands[i].attack"
              @input="setMbParam(i, 'attack', +($event.target as HTMLInputElement).value)" />
            <span>{{ mbSettings.bands[i].attack }} ms</span>
          </div>

          <div class="mb-param">
            <label>Release</label>
            <input type="range" min="50" max="2000" step="10"
              :value="mbSettings.bands[i].release"
              @input="setMbParam(i, 'release', +($event.target as HTMLInputElement).value)" />
            <span>{{ mbSettings.bands[i].release }} ms</span>
          </div>

          <div class="mb-param">
            <label>Makeup</label>
            <input type="range" min="-12" max="12" step="0.5"
              :value="mbSettings.bands[i].makeupGain"
              @input="setMbParam(i, 'makeupGain', +($event.target as HTMLInputElement).value)" />
            <span>{{ mbSettings.bands[i].makeupGain > 0 ? '+' : '' }}{{ mbSettings.bands[i].makeupGain }} dB</span>
          </div>

        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.audio-processor {
  background: var(--bg-1);
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  user-select: none;
}

/* ── Header ─────────────────────────────────────────────── */
.ap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 0;
}
.ap-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid transparent;
}
.ap-tabs button {
  padding: 5px 14px;
  border: none; background: none;
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--tx-faint); cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: color 0.12s, border-color 0.12s;
}
.ap-tabs button.active { color: var(--accent); border-bottom-color: var(--accent); }
.ap-master { display: flex; align-items: center; gap: 8px; }
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--tx-faint);
}
.toggle-btn {
  padding: 2px 8px; border-radius: 20px; border: 1px solid var(--line-2);
  background: var(--bg-2); color: var(--tx-faint);
  font-size: 10px; font-weight: 700; cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.toggle-btn.on {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent); border-color: var(--accent);
}

/* ── EQ panel ───────────────────────────────────────────── */
.eq-panel { padding: 10px 16px 12px; display: flex; flex-direction: column; gap: 10px; }
.eq-panel.disabled { opacity: 0.5; pointer-events: none; }

/* Curve */
.curve-wrap {
  position: relative;
  height: 100px;
  background: var(--bg-0);
  border-radius: 8px;
  border: 1px solid var(--line);
  overflow: hidden;
}
.curve-canvas { width: 100%; height: 100%; display: block; }
.freq-labels {
  position: absolute; bottom: 4px; left: 0; right: 0;
  display: flex; justify-content: space-between;
  padding: 0 6px;
  font-size: 9px; color: var(--tx-faint);
  font-family: 'JetBrains Mono', monospace;
  pointer-events: none;
}
.db-labels {
  position: absolute; top: 0; bottom: 0; left: 4px;
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 4px 0 18px;
  font-size: 9px; color: var(--tx-faint);
  font-family: 'JetBrains Mono', monospace;
  pointer-events: none;
}

/* Band sliders */
.eq-bands {
  display: flex;
  gap: 4px;
  align-items: flex-end;
  justify-content: space-between;
}
.eq-band {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  flex: 1;
}
.eq-band.dragging .slider-handle { transform: translateX(-50%) scale(1.3); }

.slider-track {
  position: relative;
  width: 20px; height: 100px;
  background: var(--bg-0);
  border-radius: 4px;
  border: 1px solid var(--line);
  cursor: ns-resize;
  overflow: visible;
}
.slider-center-line {
  position: absolute;
  top: 50%; left: 0; right: 0;
  height: 1px;
  background: var(--line-2);
  pointer-events: none;
}
.slider-fill {
  position: absolute;
  left: 2px; right: 2px;
  border-radius: 2px;
  pointer-events: none;
  min-height: 2px;
}
.slider-handle {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 14px; height: 14px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg-1);
  cursor: ns-resize;
  transition: transform 0.1s;
  box-shadow: 0 0 6px rgba(136,192,208,0.4);
  margin-top: -7px;
  z-index: 2;
}
.band-label {
  font-size: 9px; color: var(--tx-faint);
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
}
.band-gain {
  font-size: 9px; color: var(--accent);
  font-family: 'JetBrains Mono', monospace;
  min-width: 30px; text-align: center;
}
.band-gain.zero { color: var(--tx-faint); }

/* Preamp row */
.preamp-row {
  display: flex; align-items: center; gap: 10px;
  padding-top: 2px;
  border-top: 1px solid var(--line);
}
.preamp-label { font-size: 11px; color: var(--tx-faint); font-weight: 600; width: 54px; flex-shrink: 0; }
.preamp-slider {
  flex: 1; -webkit-appearance: none; height: 3px;
  background: var(--bg-3); border-radius: 2px; cursor: pointer; outline: none;
}
.preamp-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 11px; height: 11px;
  border-radius: 50%; background: var(--accent); cursor: pointer;
}
.preamp-val { font-size: 11px; color: var(--tx-dim); font-family: 'JetBrains Mono', monospace; width: 58px; flex-shrink: 0; }
.reset-btn {
  padding: 3px 8px; border-radius: 5px; border: 1px solid var(--line-2);
  background: var(--bg-2); color: var(--tx-faint); font-size: 10px; cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.reset-btn:hover { background: var(--bg-3); color: var(--tx); }

/* ── Compressor panel ───────────────────────────────────── */
.mb-panel {
  padding: 10px 16px 12px;
  display: flex; flex-direction: column; gap: 8px;
  overflow-y: auto;
  max-height: 320px;
}
.mb-panel.disabled { opacity: 0.5; pointer-events: none; }
.mb-band {
  background: var(--bg-0);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex; flex-direction: column; gap: 6px;
}
.mb-band-header {
  display: flex; align-items: center; gap: 8px;
}
.mb-color-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.mb-band-label { font-size: 12px; font-weight: 700; color: var(--tx); }
.mb-band-range { font-size: 10px; color: var(--tx-faint); flex: 1; font-family: 'JetBrains Mono', monospace; }
.mb-enable-btn {
  padding: 2px 7px; border-radius: 20px; border: 1px solid var(--line-2);
  background: var(--bg-2); color: var(--tx-faint);
  font-size: 9px; font-weight: 700; cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.mb-enable-btn.on {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent); border-color: var(--accent);
}
.mb-controls {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  transition: opacity 0.15s;
}
.mb-controls.muted { opacity: 0.35; pointer-events: none; }
.mb-param {
  display: flex; flex-direction: column; gap: 3px; align-items: center;
}
.mb-param label {
  font-size: 9px; color: var(--tx-faint); font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em;
  white-space: nowrap;
}
.mb-param input[type=range] {
  -webkit-appearance: none;
  writing-mode: vertical-lr;
  direction: rtl;
  width: 28px; height: 60px;
  background: transparent; cursor: pointer; outline: none;
}
.mb-param input[type=range]::-webkit-slider-runnable-track {
  width: 3px; background: var(--bg-3); border-radius: 2px;
}
.mb-param input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 12px; height: 12px;
  border-radius: 50%; background: var(--accent);
  border: 2px solid var(--bg-1); margin-left: -4.5px;
  box-shadow: 0 0 4px rgba(136,192,208,0.4);
}
.mb-param span {
  font-size: 9px; color: var(--tx-dim);
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap; text-align: center;
}
</style>
