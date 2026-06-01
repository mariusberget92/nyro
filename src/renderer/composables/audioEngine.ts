/**
 * Singleton Web Audio engine.
 *
 * Design rules:
 *  1. AudioContext is created ONLY when connectAudioElement() is called (requires
 *     a user gesture in some browsers; Electron relaxes this but we stay correct).
 *  2. EQ frequency-response canvas uses pure JS biquad math — no AudioContext needed.
 *  3. Signal chain:
 *       <audio> → MediaElementSource
 *         → preampGain
 *         → eq[0..9]  (BiquadFilterNode × 10)
 *         → bassFilter, trebleFilter
 *         → analyser
 *         → destination
 *     Multiband compressor and FX are wired in series after trebleFilter when enabled.
 */

import { reactive } from 'vue'

// ─────────────────────────────────────────────────────────────────────────────
// Band / settings types
// ─────────────────────────────────────────────────────────────────────────────

export interface EqBandDef { freq: number; type: BiquadFilterType; label: string; Q: number }

export const EQ_BANDS: EqBandDef[] = [
  { freq: 32,    type: 'lowshelf',  label: '32',  Q: 0.7 },
  { freq: 64,    type: 'peaking',   label: '64',  Q: 1.4 },
  { freq: 125,   type: 'peaking',   label: '125', Q: 1.4 },
  { freq: 250,   type: 'peaking',   label: '250', Q: 1.4 },
  { freq: 500,   type: 'peaking',   label: '500', Q: 1.4 },
  { freq: 1000,  type: 'peaking',   label: '1k',  Q: 1.4 },
  { freq: 2000,  type: 'peaking',   label: '2k',  Q: 1.4 },
  { freq: 4000,  type: 'peaking',   label: '4k',  Q: 1.4 },
  { freq: 8000,  type: 'peaking',   label: '8k',  Q: 1.4 },
  { freq: 16000, type: 'highshelf', label: '16k', Q: 0.7 },
]

export interface MbBandDef { label: string; color: string; crossLow: number | null; crossHigh: number | null }

export const MB_BANDS: MbBandDef[] = [
  { label: 'Low',      color: '#3d7fff', crossLow: null, crossHigh: 250  },
  { label: 'Low-Mid',  color: '#3fb950', crossLow: 250,  crossHigh: 2000 },
  { label: 'High-Mid', color: '#d29922', crossLow: 2000, crossHigh: 8000 },
  { label: 'High',     color: '#7c5cff', crossLow: 8000, crossHigh: null },
]

export interface EqSettings  { enabled: boolean; gains: number[]; preampGain: number }
export interface MbBandSettings { threshold: number; ratio: number; attack: number; release: number; makeupGain: number; enabled: boolean }
export interface MbSettings  { enabled: boolean; bands: MbBandSettings[] }
export interface FxSettings  {
  bassBoost:   { enabled: boolean; amount: number }
  treble:      { enabled: boolean; amount: number }
  stereoWidth: { enabled: boolean; amount: number }
  reverb:      { enabled: boolean; mix: number; roomSize: number }
  crossfeed:   { enabled: boolean; amount: number }
  limiter:     { enabled: boolean; threshold: number }
}

// ─────────────────────────────────────────────────────────────────────────────
// Persist / load helpers
// ─────────────────────────────────────────────────────────────────────────────

function defaultEq(): EqSettings  { return { enabled: false, gains: EQ_BANDS.map(() => 0), preampGain: 0 } }
function defaultMb(): MbSettings  { return { enabled: false, bands: MB_BANDS.map(() => ({ threshold: -24, ratio: 4, attack: 10, release: 200, makeupGain: 0, enabled: true })) } }
function defaultFx(): FxSettings  { return { bassBoost: { enabled: false, amount: 6 }, treble: { enabled: false, amount: 4 }, stereoWidth: { enabled: false, amount: 100 }, reverb: { enabled: false, mix: 20, roomSize: 50 }, crossfeed: { enabled: false, amount: 30 }, limiter: { enabled: false, threshold: -3 } } }

function load<T>(key: string, def: () => T): T { try { return JSON.parse(localStorage.getItem(key) ?? '') } catch { return def() } }
const saveStr = (key: string, v: unknown) => localStorage.setItem(key, JSON.stringify(v))

// ─────────────────────────────────────────────────────────────────────────────
// Reactive settings (shared with UI)
// ─────────────────────────────────────────────────────────────────────────────

export const eqSettings = reactive<EqSettings>(load('nyro-eq', defaultEq))
export const mbSettings = reactive<MbSettings>(load('nyro-mb', defaultMb))
export const fxSettings = reactive<FxSettings>(load('nyro-fx', defaultFx))

if (eqSettings.gains.length !== EQ_BANDS.length) eqSettings.gains = EQ_BANDS.map(() => 0)
if (mbSettings.bands.length !== MB_BANDS.length)  mbSettings.bands = MB_BANDS.map(() => ({ threshold: -24, ratio: 4, attack: 10, release: 200, makeupGain: 0, enabled: true }))

// Ensure all fx sub-objects exist (guard against stale localStorage from older versions)
const _fxDef = defaultFx()
if (!fxSettings.bassBoost)   fxSettings.bassBoost   = _fxDef.bassBoost
if (!fxSettings.treble)      fxSettings.treble      = _fxDef.treble
if (!fxSettings.stereoWidth) fxSettings.stereoWidth = _fxDef.stereoWidth
if (!fxSettings.reverb)      fxSettings.reverb      = _fxDef.reverb
if (!fxSettings.crossfeed)   fxSettings.crossfeed   = _fxDef.crossfeed
if (!fxSettings.limiter)     fxSettings.limiter     = _fxDef.limiter

// ─────────────────────────────────────────────────────────────────────────────
// Audio graph (null until connectAudioElement is called)
// ─────────────────────────────────────────────────────────────────────────────

let ctx:    AudioContext | null = null
let source: MediaElementAudioSourceNode | null = null

let preampNode:  GainNode | null = null
let eqFilters:   BiquadFilterNode[] = []
let bassFilter:  BiquadFilterNode | null = null
let trebleFilter:BiquadFilterNode | null = null
let analyserNode:AnalyserNode | null = null

// Multiband compressor
let mbDirectGain: GainNode | null = null
let mbInput:      GainNode | null = null
let mbMerge:      GainNode | null = null
let mbBandNodes:  Array<{ hpf: BiquadFilterNode|null; lpf: BiquadFilterNode|null; comp: DynamicsCompressorNode; makeup: GainNode }> = []

// Limiter
let limiterNode: DynamicsCompressorNode | null = null

export function getAnalyser(): AnalyserNode | null { return analyserNode }

// ─────────────────────────────────────────────────────────────────────────────
// Build / connect
// ─────────────────────────────────────────────────────────────────────────────

function db(v: number) { return Math.pow(10, v / 20) }

export function connectAudioElement(el: HTMLAudioElement) {
  if (source) return  // already wired

  ctx    = new AudioContext()
  source = ctx.createMediaElementSource(el)

  analyserNode = ctx.createAnalyser()
  analyserNode.fftSize = 128
  analyserNode.smoothingTimeConstant = 0.75

  try {
    _buildGraph()
  } catch (e) {
    console.error('[audioEngine] graph build failed — falling back to direct connection', e)
    source.connect(analyserNode)
    analyserNode.connect(ctx.destination)
  }

  if (ctx.state === 'suspended') ctx.resume()
  applyFxBassBoost()
  applyFxTreble()
  applyFxLimiter()
}

function _buildGraph() {
  if (!ctx || !source || !analyserNode) return

  preampNode = ctx.createGain()
  preampNode.gain.value = db(eqSettings.preampGain)

  // 10-band EQ
  eqFilters = EQ_BANDS.map((def, i) => {
    const f = ctx!.createBiquadFilter()
    f.type = def.type
    f.frequency.value = def.freq
    f.Q.value = def.Q
    f.gain.value = eqSettings.enabled ? eqSettings.gains[i] : 0
    return f
  })

  // Bass & treble FX filters
  bassFilter = ctx.createBiquadFilter()
  bassFilter.type = 'lowshelf'
  bassFilter.frequency.value = 100
  bassFilter.gain.value = 0

  trebleFilter = ctx.createBiquadFilter()
  trebleFilter.type = 'highshelf'
  trebleFilter.frequency.value = 8000
  trebleFilter.gain.value = 0

  // Multiband compressor section
  mbInput      = ctx.createGain()
  mbMerge      = ctx.createGain()
  mbDirectGain = ctx.createGain()
  mbDirectGain.gain.value = mbSettings.enabled ? 0 : 1
  mbInput.connect(mbDirectGain)
  mbDirectGain.connect(mbMerge)

  mbBandNodes = MB_BANDS.map((def, i) => {
    const bs   = mbSettings.bands[i]
    const comp = ctx!.createDynamicsCompressor()
    comp.threshold.value = bs.threshold
    comp.ratio.value     = bs.ratio
    comp.attack.value    = bs.attack  / 1000
    comp.release.value   = bs.release / 1000
    const makeup = ctx!.createGain()
    makeup.gain.value = mbSettings.enabled && bs.enabled ? db(bs.makeupGain) : 0

    let hpf: BiquadFilterNode | null = null
    let lpf: BiquadFilterNode | null = null
    if (def.crossLow  !== null) { hpf = ctx!.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = def.crossLow;  hpf.Q.value = 0.7 }
    if (def.crossHigh !== null) { lpf = ctx!.createBiquadFilter(); lpf.type = 'lowpass';  lpf.frequency.value = def.crossHigh; lpf.Q.value = 0.7 }

    let entry: AudioNode = mbInput!
    if (hpf) { entry.connect(hpf); entry = hpf }
    if (lpf) { entry.connect(lpf); entry = lpf }
    entry.connect(comp)
    comp.connect(makeup)
    makeup.connect(mbMerge!)
    return { hpf, lpf, comp, makeup }
  })

  // Limiter
  limiterNode = ctx.createDynamicsCompressor()
  limiterNode.knee.value    = 3
  limiterNode.ratio.value   = fxSettings.limiter.enabled ? 20 : 1
  limiterNode.attack.value  = 0.003
  limiterNode.release.value = 0.1
  limiterNode.threshold.value = fxSettings.limiter.enabled ? fxSettings.limiter.threshold : 0

  // Wire: source → preamp → eq[0..9] → mbInput → mbMerge → bass → treble → limiter → analyser → dest
  source!.connect(preampNode)
  let node: AudioNode = preampNode
  for (const f of eqFilters) { node.connect(f); node = f }
  node.connect(mbInput)
  mbMerge.connect(bassFilter)
  bassFilter.connect(trebleFilter)
  trebleFilter.connect(limiterNode)
  limiterNode.connect(analyserNode!)
  analyserNode!.connect(ctx.destination)
}

export function resumeContext() { if (ctx?.state === 'suspended') ctx.resume() }

// ─────────────────────────────────────────────────────────────────────────────
// EQ controls
// ─────────────────────────────────────────────────────────────────────────────

export function setEqGain(band: number, val: number) {
  eqSettings.gains[band] = val
  if (eqFilters[band]) eqFilters[band].gain.value = eqSettings.enabled ? val : 0
  saveStr('nyro-eq', eqSettings)
}

export function applyEqEnabled() {
  eqFilters.forEach((f, i) => { f.gain.value = eqSettings.enabled ? eqSettings.gains[i] : 0 })
  if (preampNode) preampNode.gain.value = eqSettings.enabled ? db(eqSettings.preampGain) : 1
  saveStr('nyro-eq', eqSettings)
}

export function applyPreamp() {
  if (preampNode) preampNode.gain.value = db(eqSettings.preampGain)
  saveStr('nyro-eq', eqSettings)
}

// ─────────────────────────────────────────────────────────────────────────────
// Multiband compressor controls
// ─────────────────────────────────────────────────────────────────────────────

export function applyMbEnabled() {
  if (mbDirectGain) mbDirectGain.gain.value = mbSettings.enabled ? 0 : 1
  mbBandNodes.forEach((n, i) => {
    const bs = mbSettings.bands[i]
    n.makeup.gain.value = mbSettings.enabled && bs.enabled ? db(bs.makeupGain) : 0
  })
  saveStr('nyro-mb', mbSettings)
}

export function setMbParam(band: number, param: keyof MbBandSettings, value: number | boolean) {
  ;(mbSettings.bands[band] as any)[param] = value
  const n  = mbBandNodes[band]
  const bs = mbSettings.bands[band]
  if (!n) { saveStr('nyro-mb', mbSettings); return }
  if (param === 'threshold')  n.comp.threshold.value = value as number
  if (param === 'ratio')      n.comp.ratio.value     = value as number
  if (param === 'attack')     n.comp.attack.value    = (value as number) / 1000
  if (param === 'release')    n.comp.release.value   = (value as number) / 1000
  if (param === 'makeupGain') n.makeup.gain.value    = db(value as number)
  if (param === 'enabled')    n.makeup.gain.value    = mbSettings.enabled && bs.enabled ? db(bs.makeupGain) : 0
  saveStr('nyro-mb', mbSettings)
}

// ─────────────────────────────────────────────────────────────────────────────
// FX controls
// ─────────────────────────────────────────────────────────────────────────────

export function applyFxBassBoost() {
  if (bassFilter) bassFilter.gain.value = fxSettings.bassBoost.enabled ? fxSettings.bassBoost.amount : 0
  saveStr('nyro-fx', fxSettings)
}
export function applyFxTreble() {
  if (trebleFilter) trebleFilter.gain.value = fxSettings.treble.enabled ? fxSettings.treble.amount : 0
  saveStr('nyro-fx', fxSettings)
}
export function applyFxStereoWidth() { saveStr('nyro-fx', fxSettings) /* TODO: M/S nodes */ }
export function applyFxReverb()      { saveStr('nyro-fx', fxSettings) /* TODO: convolver */  }
export function applyFxCrossfeed()   { saveStr('nyro-fx', fxSettings) /* TODO: crossfeed */  }
export function applyFxLimiter() {
  if (limiterNode) {
    limiterNode.threshold.value = fxSettings.limiter.enabled ? fxSettings.limiter.threshold : 0
    limiterNode.ratio.value     = fxSettings.limiter.enabled ? 20 : 1
  }
  saveStr('nyro-fx', fxSettings)
}

// ─────────────────────────────────────────────────────────────────────────────
// EQ frequency-response curve — pure math, no AudioContext required
// ─────────────────────────────────────────────────────────────────────────────

const FREQ_POINTS = 512
const SAMPLE_RATE = 48000  // representative value for canvas math

export function getFreqArray_public(): Float32Array {
  const a = new Float32Array(FREQ_POINTS)
  for (let i = 0; i < FREQ_POINTS; i++) a[i] = 20 * Math.pow(1000, i / (FREQ_POINTS - 1))
  return a
}

/** Compute biquad coefficients (Web Audio spec) */
function biquadCoeffs(type: BiquadFilterType, freq: number, Q: number, gainDb: number) {
  const w0    = (2 * Math.PI * freq) / SAMPLE_RATE
  const cosW  = Math.cos(w0)
  const sinW  = Math.sin(w0)
  const alpha = sinW / (2 * Q)
  const A     = Math.pow(10, gainDb / 40)

  let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0

  if (type === 'peaking') {
    b0 = 1 + alpha * A;  b1 = -2 * cosW;  b2 = 1 - alpha * A
    a0 = 1 + alpha / A;  a1 = -2 * cosW;  a2 = 1 - alpha / A
  } else if (type === 'lowshelf') {
    const sqA = Math.sqrt(A)
    const ap1 = A + 1, am1 = A - 1
    const sq2a = 2 * sqA * alpha
    b0 = A  * (ap1 - am1 * cosW + sq2a)
    b1 = 2  * A * (am1 - ap1 * cosW)
    b2 = A  * (ap1 - am1 * cosW - sq2a)
    a0 =       ap1 + am1 * cosW + sq2a
    a1 = -2  * (am1 + ap1 * cosW)
    a2 =       ap1 + am1 * cosW - sq2a
  } else if (type === 'highshelf') {
    const sqA = Math.sqrt(A)
    const ap1 = A + 1, am1 = A - 1
    const sq2a = 2 * sqA * alpha
    b0 = A  * (ap1 + am1 * cosW + sq2a)
    b1 = -2 * A * (am1 + ap1 * cosW)
    b2 = A  * (ap1 + am1 * cosW - sq2a)
    a0 =       ap1 - am1 * cosW + sq2a
    a1 = 2   * (am1 - ap1 * cosW)
    a2 =       ap1 - am1 * cosW - sq2a
  }

  return { b0: b0/a0, b1: b1/a0, b2: b2/a0, a1: a1/a0, a2: a2/a0 }
}

/** Magnitude response |H(e^jω)| for a single biquad at one frequency */
function biquadMag(b0: number, b1: number, b2: number, a1: number, a2: number, w: number): number {
  const cosW = Math.cos(w), cos2W = Math.cos(2 * w)
  const sinW = Math.sin(w), sin2W = Math.sin(2 * w)
  const numR = b0 + b1 * cosW + b2 * cos2W
  const numI =      b1 * sinW + b2 * sin2W
  const denR = 1  + a1 * cosW + a2 * cos2W
  const denI =      a1 * sinW + a2 * sin2W
  const numMag2 = numR * numR + numI * numI
  const denMag2 = denR * denR + denI * denI
  return denMag2 < 1e-30 ? 1 : Math.sqrt(numMag2 / denMag2)
}

export function getEqResponse(): Float32Array {
  const freqs  = getFreqArray_public()
  const result = new Float32Array(FREQ_POINTS).fill(1)

  if (!eqSettings.enabled) return result

  // Preamp
  const preampLin = db(eqSettings.preampGain)

  for (let bi = 0; bi < EQ_BANDS.length; bi++) {
    const def = EQ_BANDS[bi]
    const g   = eqSettings.gains[bi]
    if (g === 0) continue  // flat — skip
    const { b0, b1, b2, a1, a2 } = biquadCoeffs(def.type, def.freq, def.Q, g)
    for (let i = 0; i < FREQ_POINTS; i++) {
      const w = (2 * Math.PI * freqs[i]) / SAMPLE_RATE
      result[i] *= biquadMag(b0, b1, b2, a1, a2, w)
    }
  }

  for (let i = 0; i < FREQ_POINTS; i++) result[i] *= preampLin
  return result
}
