<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  EQ_BANDS, MB_BANDS,
  eqSettings, mbSettings, fxSettings,
  setEqGain, applyEqEnabled, applyMbEnabled, applyPreamp,
  setMbParam, getEqResponse, getFreqArray_public,
  applyFxBassBoost, applyFxTreble, applyFxStereoWidth,
  applyFxReverb, applyFxCrossfeed, applyFxLimiter,
} from '../composables/audioEngine'

type Tab = 'eq' | 'compressor' | 'fx'
const tab = ref<Tab>('eq')

// ── EQ canvas ────────────────────────────────────────────────────────────────
const canvas = ref<HTMLCanvasElement | null>(null)
let animFrame = 0

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
  const midY     = H / 2

  // Grid dB lines
  ctx.strokeStyle = 'rgba(255,255,255,0.055)'
  ctx.lineWidth = 1
  for (const db of [-12, -9, -6, -3, 0, 3, 6, 9, 12]) {
    const y = midY - (db / 12) * midY * 0.9
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  // Freq grid
  for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
    const x = Math.log10(f / 20) / Math.log10(1000) * W
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  // 0 dB centre
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke()

  if (!eqSettings.enabled) {
    ctx.strokeStyle = 'var(--accent-glow)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke()
    ctx.setLineDash([])
    return
  }

  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0,   'var(--accent-glow)')
  grad.addColorStop(0.5, 'rgba(88,166,255,0.06)')
  grad.addColorStop(1,   'rgba(136,192,208,0)')

  ctx.beginPath()
  for (let i = 0; i < N; i++) {
    const x  = Math.log10(freqs[i] / 20) / Math.log10(1000) * W
    const db = 20 * Math.log10(Math.max(1e-6, response[i]))
    const y  = midY - (db / 12) * midY * 0.9
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.lineTo(W, midY); ctx.lineTo(0, midY); ctx.closePath()
  ctx.fillStyle = grad; ctx.fill()

  ctx.beginPath()
  for (let i = 0; i < N; i++) {
    const x  = Math.log10(freqs[i] / 20) / Math.log10(1000) * W
    const db = 20 * Math.log10(Math.max(1e-6, response[i]))
    const y  = midY - (db / 12) * midY * 0.9
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.strokeStyle = 'var(--accent)'; ctx.lineWidth = 2; ctx.stroke()
}

function scheduleRedraw() {
  cancelAnimationFrame(animFrame)
  animFrame = requestAnimationFrame(drawCurve)
}

watch(() => [...eqSettings.gains, eqSettings.preampGain, eqSettings.enabled], scheduleRedraw)

onMounted(() => { nextTick(drawCurve); window.addEventListener('resize', scheduleRedraw) })
onUnmounted(() => { cancelAnimationFrame(animFrame); window.removeEventListener('resize', scheduleRedraw) })

// ── EQ dragging ───────────────────────────────────────────────────────────────
const dragging   = ref<number | null>(null)
const dragStartY = ref(0)
const dragStart  = ref(0)
const EQ_MIN = -12; const EQ_MAX = 12

function startDrag(e: PointerEvent, i: number) {
  dragging.value = i; dragStartY.value = e.clientY; dragStart.value = eqSettings.gains[i]
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', stopDrag)
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
}
function onDrag(e: PointerEvent) {
  if (dragging.value === null) return
  const dy    = dragStartY.value - e.clientY
  const delta = (dy / 100) * (EQ_MAX - EQ_MIN)
  setEqGain(dragging.value, Math.round(Math.max(EQ_MIN, Math.min(EQ_MAX, dragStart.value + delta)) * 10) / 10)
}
function stopDrag() {
  dragging.value = null
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', stopDrag)
}
function gainPct(g: number) { return 50 - (g / EQ_MAX) * 50 }

// ── Compressor helpers ────────────────────────────────────────────────────────
function ratioLabel(r: number) { return r >= 20 ? '∞:1' : `${r}:1` }
</script>

<template>
  <div class="eq-page">

    <!-- Header -->
    <header class="eq-header">
      <h1 class="eq-title">Equalizer</h1>
      <div class="spacer" />
      <div class="tab-row">
        <button :class="{ active: tab === 'eq' }"         @click="tab = 'eq'">Graphic EQ</button>
        <button :class="{ active: tab === 'compressor' }" @click="tab = 'compressor'">Compressor</button>
        <button :class="{ active: tab === 'fx' }"         @click="tab = 'fx'">Effects</button>
      </div>
    </header>

    <div class="eq-body">

      <!-- ═══════════════════════════ GRAPHIC EQ ═══════════════════════════ -->
      <div v-if="tab === 'eq'" class="panel">

        <div class="panel-toolbar">
          <span class="panel-label">10-BAND EQUALIZER</span>
          <div class="spacer" />
          <button class="flat-btn" @click="EQ_BANDS.forEach((_, i) => setEqGain(i, 0)); eqSettings.preampGain = 0; applyPreamp()">Flat</button>
          <button
            class="toggle-pill" :class="{ on: eqSettings.enabled }"
            @click="eqSettings.enabled = !eqSettings.enabled; applyEqEnabled()"
          >{{ eqSettings.enabled ? 'ON' : 'OFF' }}</button>
        </div>

        <!-- Frequency response canvas -->
        <div class="curve-wrap" :class="{ dim: !eqSettings.enabled }">
          <canvas ref="canvas" class="curve-canvas" />
          <div class="freq-axis">
            <span>20</span><span>50</span><span>100</span><span>200</span>
            <span>500</span><span>1k</span><span>2k</span><span>5k</span>
            <span>10k</span><span>20k</span>
          </div>
          <div class="db-axis">
            <span>+12</span><span>+6</span><span>0</span><span>-6</span><span>-12</span>
          </div>
        </div>

        <!-- Band sliders -->
        <div class="bands-row" :class="{ dim: !eqSettings.enabled }">
          <div
            v-for="(def, i) in EQ_BANDS" :key="def.freq"
            class="band-col"
            :class="{ dragging: dragging === i }"
          >
            <span class="band-gain" :class="{ zero: eqSettings.gains[i] === 0 }">
              {{ eqSettings.gains[i] > 0 ? '+' : '' }}{{ eqSettings.gains[i].toFixed(1) }}
            </span>
            <div class="slider-track" @dblclick="setEqGain(i, 0)">
              <div class="slider-center" />
              <div class="slider-fill" :style="{
                top:    eqSettings.gains[i] >= 0 ? `${gainPct(eqSettings.gains[i])}%` : '50%',
                height: `${Math.abs(eqSettings.gains[i]) / EQ_MAX * 50}%`,
                background: eqSettings.gains[i] >= 0 ? 'var(--accent)' : 'var(--bad)',
              }" />
              <div class="slider-handle" :style="{ top: `${gainPct(eqSettings.gains[i])}%` }"
                @pointerdown="startDrag($event, i)" />
            </div>
            <span class="band-label">{{ def.label }}</span>
          </div>
        </div>

        <!-- Preamp -->
        <div class="preamp-row">
          <span class="row-label">Preamp</span>
          <input type="range" class="h-slider" :min="EQ_MIN" :max="EQ_MAX" step="0.5"
            v-model.number="eqSettings.preampGain" @input="applyPreamp()" />
          <span class="row-val">{{ eqSettings.preampGain > 0 ? '+' : '' }}{{ eqSettings.preampGain.toFixed(1) }} dB</span>
          <button class="flat-btn" @click="eqSettings.preampGain = 0; applyPreamp()">Reset</button>
        </div>

      </div>

      <!-- ═══════════════════════════ COMPRESSOR ═══════════════════════════ -->
      <div v-else-if="tab === 'compressor'" class="panel">

        <div class="panel-toolbar">
          <span class="panel-label">MULTIBAND COMPRESSOR</span>
          <div class="spacer" />
          <button
            class="toggle-pill" :class="{ on: mbSettings.enabled }"
            @click="mbSettings.enabled = !mbSettings.enabled; applyMbEnabled()"
          >{{ mbSettings.enabled ? 'ON' : 'OFF' }}</button>
        </div>

        <div class="mb-grid" :class="{ dim: !mbSettings.enabled }">
          <div v-for="(def, i) in MB_BANDS" :key="def.label" class="mb-card">
            <div class="mb-card-head">
              <span class="mb-dot" :style="{ background: def.color }" />
              <span class="mb-name">{{ def.label }}</span>
              <span class="mb-range">
                {{ def.crossLow ? (def.crossLow >= 1000 ? def.crossLow/1000+'k' : def.crossLow)+'Hz' : '20Hz' }}
                –
                {{ def.crossHigh ? (def.crossHigh >= 1000 ? def.crossHigh/1000+'k' : def.crossHigh)+'Hz' : '20kHz' }}
              </span>
              <button class="toggle-pill small" :class="{ on: mbSettings.bands[i].enabled }"
                @click="setMbParam(i, 'enabled', !mbSettings.bands[i].enabled)">
                {{ mbSettings.bands[i].enabled ? 'ON' : 'OFF' }}
              </button>
            </div>
            <div class="mb-params" :class="{ muted: !mbSettings.bands[i].enabled }">
              <div class="mb-param">
                <label>Threshold</label>
                <input type="range" class="v-slider" min="-60" max="0" step="1"
                  :value="mbSettings.bands[i].threshold"
                  @input="setMbParam(i, 'threshold', +($event.target as HTMLInputElement).value)" />
                <span>{{ mbSettings.bands[i].threshold }} dB</span>
              </div>
              <div class="mb-param">
                <label>Ratio</label>
                <input type="range" class="v-slider" min="1" max="20" step="0.5"
                  :value="mbSettings.bands[i].ratio"
                  @input="setMbParam(i, 'ratio', +($event.target as HTMLInputElement).value)" />
                <span>{{ ratioLabel(mbSettings.bands[i].ratio) }}</span>
              </div>
              <div class="mb-param">
                <label>Attack</label>
                <input type="range" class="v-slider" min="0" max="200" step="1"
                  :value="mbSettings.bands[i].attack"
                  @input="setMbParam(i, 'attack', +($event.target as HTMLInputElement).value)" />
                <span>{{ mbSettings.bands[i].attack }}ms</span>
              </div>
              <div class="mb-param">
                <label>Release</label>
                <input type="range" class="v-slider" min="50" max="2000" step="10"
                  :value="mbSettings.bands[i].release"
                  @input="setMbParam(i, 'release', +($event.target as HTMLInputElement).value)" />
                <span>{{ mbSettings.bands[i].release }}ms</span>
              </div>
              <div class="mb-param">
                <label>Makeup</label>
                <input type="range" class="v-slider" min="-12" max="12" step="0.5"
                  :value="mbSettings.bands[i].makeupGain"
                  @input="setMbParam(i, 'makeupGain', +($event.target as HTMLInputElement).value)" />
                <span>{{ mbSettings.bands[i].makeupGain > 0 ? '+' : '' }}{{ mbSettings.bands[i].makeupGain }}dB</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════ EFFECTS ══════════════════════════════ -->
      <div v-else class="panel fx-panel">

        <!-- Bass Boost -->
        <div class="fx-card">
          <div class="fx-card-head">
            <span class="fx-icon bass-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              </svg>
            </span>
            <span class="fx-name">Bass Boost</span>
            <div class="spacer" />
            <button class="toggle-pill" :class="{ on: fxSettings.bassBoost.enabled }"
              @click="fxSettings.bassBoost.enabled = !fxSettings.bassBoost.enabled; applyFxBassBoost()">
              {{ fxSettings.bassBoost.enabled ? 'ON' : 'OFF' }}
            </button>
          </div>
          <div class="fx-controls" :class="{ dim: !fxSettings.bassBoost.enabled }">
            <div class="fx-row">
              <span class="row-label">Gain</span>
              <input type="range" class="h-slider" min="0" max="15" step="0.5"
                v-model.number="fxSettings.bassBoost.amount" @input="applyFxBassBoost()" />
              <span class="row-val">+{{ fxSettings.bassBoost.amount.toFixed(1) }} dB</span>
            </div>
          </div>
          <p class="fx-desc">Low-shelf boost at 100 Hz. Adds punch and warmth.</p>
        </div>

        <!-- Treble Enhancement -->
        <div class="fx-card">
          <div class="fx-card-head">
            <span class="fx-icon treble-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </span>
            <span class="fx-name">Treble Enhancement</span>
            <div class="spacer" />
            <button class="toggle-pill" :class="{ on: fxSettings.treble.enabled }"
              @click="fxSettings.treble.enabled = !fxSettings.treble.enabled; applyFxTreble()">
              {{ fxSettings.treble.enabled ? 'ON' : 'OFF' }}
            </button>
          </div>
          <div class="fx-controls" :class="{ dim: !fxSettings.treble.enabled }">
            <div class="fx-row">
              <span class="row-label">Gain</span>
              <input type="range" class="h-slider" min="0" max="12" step="0.5"
                v-model.number="fxSettings.treble.amount" @input="applyFxTreble()" />
              <span class="row-val">+{{ fxSettings.treble.amount.toFixed(1) }} dB</span>
            </div>
          </div>
          <p class="fx-desc">High-shelf boost at 8 kHz. Adds air and detail.</p>
        </div>

        <!-- Stereo Widener -->
        <div class="fx-card">
          <div class="fx-card-head">
            <span class="fx-icon stereo-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M18 8L22 12L18 16"/><path d="M6 8L2 12L6 16"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
              </svg>
            </span>
            <span class="fx-name">Stereo Widener</span>
            <div class="spacer" />
            <button class="toggle-pill" :class="{ on: fxSettings.stereoWidth.enabled }"
              @click="fxSettings.stereoWidth.enabled = !fxSettings.stereoWidth.enabled; applyFxStereoWidth()">
              {{ fxSettings.stereoWidth.enabled ? 'ON' : 'OFF' }}
            </button>
          </div>
          <div class="fx-controls" :class="{ dim: !fxSettings.stereoWidth.enabled }">
            <div class="fx-row">
              <span class="row-label">Width</span>
              <input type="range" class="h-slider" min="0" max="200" step="1"
                v-model.number="fxSettings.stereoWidth.amount" @input="applyFxStereoWidth()" />
              <span class="row-val">{{ fxSettings.stereoWidth.amount }}%</span>
            </div>
            <div class="width-labels">
              <span>Mono</span><span>Normal</span><span>Wide</span>
            </div>
          </div>
          <p class="fx-desc">M/S processing. 100% = normal stereo. 0% = mono. 200% = ultra-wide.</p>
        </div>

        <!-- Reverb -->
        <div class="fx-card">
          <div class="fx-card-head">
            <span class="fx-icon reverb-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>
              </svg>
            </span>
            <span class="fx-name">Reverb</span>
            <div class="spacer" />
            <button class="toggle-pill" :class="{ on: fxSettings.reverb.enabled }"
              @click="fxSettings.reverb.enabled = !fxSettings.reverb.enabled; applyFxReverb()">
              {{ fxSettings.reverb.enabled ? 'ON' : 'OFF' }}
            </button>
          </div>
          <div class="fx-controls" :class="{ dim: !fxSettings.reverb.enabled }">
            <div class="fx-row">
              <span class="row-label">Room Size</span>
              <input type="range" class="h-slider" min="0" max="100" step="1"
                v-model.number="fxSettings.reverb.roomSize" @input="applyFxReverb()" />
              <span class="row-val">{{ fxSettings.reverb.roomSize }}%</span>
            </div>
            <div class="fx-row">
              <span class="row-label">Mix</span>
              <input type="range" class="h-slider" min="0" max="100" step="1"
                v-model.number="fxSettings.reverb.mix" @input="applyFxReverb()" />
              <span class="row-val">{{ fxSettings.reverb.mix }}%</span>
            </div>
          </div>
          <p class="fx-desc">Convolution reverb with synthetic impulse response. Adds space and depth.</p>
        </div>

        <!-- Crossfeed -->
        <div class="fx-card">
          <div class="fx-card-head">
            <span class="fx-icon cf-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M3 6h6v6H3z"/><path d="M15 12h6v6h-6z"/>
                <path d="M9 9l6 6M9 15l6-6" opacity="0.5"/>
              </svg>
            </span>
            <span class="fx-name">Crossfeed</span>
            <div class="spacer" />
            <button class="toggle-pill" :class="{ on: fxSettings.crossfeed.enabled }"
              @click="fxSettings.crossfeed.enabled = !fxSettings.crossfeed.enabled; applyFxCrossfeed()">
              {{ fxSettings.crossfeed.enabled ? 'ON' : 'OFF' }}
            </button>
          </div>
          <div class="fx-controls" :class="{ dim: !fxSettings.crossfeed.enabled }">
            <div class="fx-row">
              <span class="row-label">Amount</span>
              <input type="range" class="h-slider" min="0" max="100" step="1"
                v-model.number="fxSettings.crossfeed.amount" @input="applyFxCrossfeed()" />
              <span class="row-val">{{ fxSettings.crossfeed.amount }}%</span>
            </div>
          </div>
          <p class="fx-desc">Mixes low-pass filtered L→R and R→L with a short delay. Reduces headphone fatigue.</p>
        </div>

        <!-- Limiter -->
        <div class="fx-card">
          <div class="fx-card-head">
            <span class="fx-icon limiter-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <line x1="4" y1="8" x2="20" y2="8"/><path d="M4 12h4l3 7 4-14 3 7h6"/>
              </svg>
            </span>
            <span class="fx-name">Limiter</span>
            <div class="spacer" />
            <button class="toggle-pill" :class="{ on: fxSettings.limiter.enabled }"
              @click="fxSettings.limiter.enabled = !fxSettings.limiter.enabled; applyFxLimiter()">
              {{ fxSettings.limiter.enabled ? 'ON' : 'OFF' }}
            </button>
          </div>
          <div class="fx-controls" :class="{ dim: !fxSettings.limiter.enabled }">
            <div class="fx-row">
              <span class="row-label">Ceiling</span>
              <input type="range" class="h-slider" min="-24" max="0" step="0.5"
                v-model.number="fxSettings.limiter.threshold" @input="applyFxLimiter()" />
              <span class="row-val">{{ fxSettings.limiter.threshold }} dB</span>
            </div>
          </div>
          <p class="fx-desc">Hard limiter (20:1 ratio, 3ms attack). Prevents clipping and tames peaks.</p>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.eq-page { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

/* ── Header ─────────────────────────────── */
.eq-header {
  display: flex; align-items: center; gap: 12px;
  padding: 0 20px; height: 52px; flex-shrink: 0;
  background: linear-gradient(to bottom, var(--bg-1), var(--bg-0));
  border-bottom: 1px solid var(--line);
}
.eq-title { font-size: 15px; font-weight: 800; color: var(--tx); margin: 0; }
.spacer { flex: 1; }
.tab-row { display: flex; gap: 0; }
.tab-row button {
  padding: 6px 16px; border: none; background: none;
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--tx-faint); cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: color 0.12s, border-color 0.12s;
}
.tab-row button:hover { color: var(--tx-dim); }
.tab-row button.active { color: var(--accent); border-bottom-color: var(--accent); }

/* ── Body ───────────────────────────────── */
.eq-body { flex: 1; overflow-y: auto; padding: 20px; }

.panel { display: flex; flex-direction: column; gap: 14px; }
.panel-toolbar {
  display: flex; align-items: center; gap: 10px;
}
.panel-label {
  font-size: 10px; font-weight: 700; color: var(--tx-faint);
  letter-spacing: 0.1em;
}

/* ── Toggle pill ────────────────────────── */
.toggle-pill {
  padding: 3px 10px; border-radius: 20px;
  border: 1px solid var(--line-2); background: var(--bg-2);
  color: var(--tx-faint); font-size: 10px; font-weight: 700;
  cursor: pointer; transition: all 0.12s;
}
.toggle-pill.small { padding: 2px 7px; font-size: 9px; }
.toggle-pill.on {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent); border-color: var(--accent);
}

.flat-btn {
  padding: 3px 9px; border-radius: 6px;
  border: 1px solid var(--line-2); background: var(--bg-2);
  color: var(--tx-faint); font-size: 10px; font-weight: 600; cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.flat-btn:hover { background: var(--bg-3); color: var(--tx); }

.dim { opacity: 0.45; pointer-events: none; }

/* ── Curve canvas ───────────────────────── */
.curve-wrap {
  position: relative; height: 160px;
  background: var(--bg-0); border-radius: 10px;
  border: 1px solid var(--line); overflow: hidden;
}
.curve-canvas { width: 100%; height: 100%; display: block; }
.freq-axis {
  position: absolute; bottom: 5px; left: 32px; right: 8px;
  display: flex; justify-content: space-between;
  font-size: 9px; color: var(--tx-faint);
  font-family: 'JetBrains Mono', monospace; pointer-events: none;
}
.db-axis {
  position: absolute; top: 0; bottom: 0; left: 4px;
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 6px 0 20px;
  font-size: 9px; color: var(--tx-faint);
  font-family: 'JetBrains Mono', monospace; pointer-events: none;
}

/* ── Band sliders ───────────────────────── */
.bands-row {
  display: flex; justify-content: space-between; gap: 4px;
  padding: 0 4px;
}
.band-col {
  display: flex; flex-direction: column; align-items: center; gap: 3px; flex: 1;
}
.band-col.dragging .slider-handle { transform: translateX(-50%) scale(1.3); }
.band-gain {
  font-size: 9px; color: var(--accent);
  font-family: 'JetBrains Mono', monospace; min-width: 28px; text-align: center;
}
.band-gain.zero { color: var(--tx-faint); }
.slider-track {
  position: relative; width: 22px; height: 110px;
  background: var(--bg-0); border-radius: 4px; border: 1px solid var(--line);
  cursor: ns-resize;
}
.slider-center {
  position: absolute; top: 50%; left: 0; right: 0; height: 1px;
  background: var(--line-2); pointer-events: none;
}
.slider-fill {
  position: absolute; left: 3px; right: 3px; border-radius: 2px;
  pointer-events: none; min-height: 2px;
}
.slider-handle {
  position: absolute; left: 50%; transform: translateX(-50%);
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--accent); border: 2px solid var(--bg-1);
  cursor: ns-resize; transition: transform 0.1s;
  box-shadow: 0 0 8px var(--accent-glow-strong);
  margin-top: -8px; z-index: 2;
}
.band-label {
  font-size: 9px; color: var(--tx-faint);
  font-family: 'JetBrains Mono', monospace; white-space: nowrap;
}

/* ── Preamp row ─────────────────────────── */
.preamp-row, .fx-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 4px;
  border-top: 1px solid var(--line);
}
.row-label {
  font-size: 11px; font-weight: 600; color: var(--tx-faint);
  width: 72px; flex-shrink: 0;
}
.row-val {
  font-size: 11px; color: var(--tx-dim);
  font-family: 'JetBrains Mono', monospace; width: 68px; flex-shrink: 0; text-align: right;
}
.h-slider {
  flex: 1; -webkit-appearance: none; height: 4px;
  background: var(--bg-3); border-radius: 2px; cursor: pointer; outline: none;
}
.h-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 14px; height: 14px;
  border-radius: 50%; background: var(--accent); cursor: pointer;
  box-shadow: 0 0 6px var(--accent-glow-strong);
}

/* ── Compressor grid ────────────────────── */
.mb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.mb-card {
  background: var(--bg-0); border: 1px solid var(--line); border-radius: 10px;
  padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;
}
.mb-card-head { display: flex; align-items: center; gap: 8px; }
.mb-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.mb-name { font-size: 13px; font-weight: 700; color: var(--tx); }
.mb-range { font-size: 10px; color: var(--tx-faint); flex: 1; font-family: 'JetBrains Mono', monospace; }
.mb-params {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
  transition: opacity 0.15s;
}
.mb-params.muted { opacity: 0.3; pointer-events: none; }
.mb-param { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.mb-param label {
  font-size: 9px; color: var(--tx-faint); font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;
}
.v-slider {
  -webkit-appearance: none;
  writing-mode: vertical-lr; direction: rtl;
  width: 28px; height: 70px;
  background: transparent; cursor: pointer; outline: none;
}
.v-slider::-webkit-slider-runnable-track { width: 3px; background: var(--bg-3); border-radius: 2px; }
.v-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 13px; height: 13px;
  border-radius: 50%; background: var(--accent);
  border: 2px solid var(--bg-1); margin-left: -5px;
  box-shadow: 0 0 5px var(--accent-glow-strong);
}
.mb-param span {
  font-size: 9px; color: var(--tx-dim);
  font-family: 'JetBrains Mono', monospace; white-space: nowrap;
}

/* ── FX panel ───────────────────────────── */
.fx-panel { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.fx-card {
  background: var(--bg-1); border: 1px solid var(--line);
  border-radius: 12px; padding: 14px 16px;
  display: flex; flex-direction: column; gap: 8px;
}
.fx-card-head { display: flex; align-items: center; gap: 10px; }
.fx-icon {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.bass-icon    { background: var(--accent-glow); color: var(--accent); }
.treble-icon  { background: rgba(163,190,140,0.12); color: var(--ok); }
.stereo-icon  { background: rgba(180,142,173,0.12); color: var(--conv); }
.reverb-icon  { background: rgba(235,203,139,0.12); color: var(--warn); }
.cf-icon      { background: var(--accent-glow); color: var(--accent-2); }
.limiter-icon { background: rgba(191,97,106,0.12);  color: var(--bad); }
.fx-name { font-size: 13px; font-weight: 700; color: var(--tx); }
.fx-controls { display: flex; flex-direction: column; gap: 0; }
.fx-row { border-top: 1px solid var(--line); padding: 7px 0; display: flex; align-items: center; gap: 10px; }
.fx-row:first-child { border-top: none; }
.fx-desc {
  font-size: 10.5px; color: var(--tx-faint); margin: 0;
  line-height: 1.5; padding-top: 4px;
}
.width-labels {
  display: flex; justify-content: space-between;
  font-size: 9px; color: var(--tx-faint);
  font-family: 'JetBrains Mono', monospace;
  padding: 0 2px;
}
</style>
