/**
 * Singleton Web Audio engine.
 * Call connect(audioEl) once when the <audio> element is ready.
 * All state is reactive so the UI can bind directly.
 *
 * Signal chain:
 *   <audio> → MediaElementSource → [10-band EQ] → [4-band compressor] → destination
 *
 * The multiband compressor splits the signal into 4 parallel paths using
 * crossover filters, runs a DynamicsCompressorNode on each, then sums.
 */

import { reactive, readonly } from 'vue'

// ── Band definitions ─────────────────────────────────────────────────────────

export interface EqBandDef {
  freq: number
  type: BiquadFilterType
  label: string
  Q: number
}

export const EQ_BANDS: EqBandDef[] = [
  { freq: 32,    type: 'lowshelf',  label: '32',   Q: 0.7 },
  { freq: 64,    type: 'peaking',   label: '64',   Q: 1.4 },
  { freq: 125,   type: 'peaking',   label: '125',  Q: 1.4 },
  { freq: 250,   type: 'peaking',   label: '250',  Q: 1.4 },
  { freq: 500,   type: 'peaking',   label: '500',  Q: 1.4 },
  { freq: 1000,  type: 'peaking',   label: '1k',   Q: 1.4 },
  { freq: 2000,  type: 'peaking',   label: '2k',   Q: 1.4 },
  { freq: 4000,  type: 'peaking',   label: '4k',   Q: 1.4 },
  { freq: 8000,  type: 'peaking',   label: '8k',   Q: 1.4 },
  { freq: 16000, type: 'highshelf', label: '16k',  Q: 0.7 },
]

export interface MbBandDef {
  label: string
  color: string
  crossLow:  number | null   // HPF cutoff (null = no HPF)
  crossHigh: number | null   // LPF cutoff (null = no LPF)
}

export const MB_BANDS: MbBandDef[] = [
  { label: 'Low',      color: '#3d7fff', crossLow: null, crossHigh: 250  },
  { label: 'Low-Mid',  color: '#3fb950', crossLow: 250,  crossHigh: 2000 },
  { label: 'High-Mid', color: '#d29922', crossLow: 2000, crossHigh: 8000 },
  { label: 'High',     color: '#7c5cff', crossLow: 8000, crossHigh: null },
]

// ── FX definitions ───────────────────────────────────────────────────────────

export interface FxSettings {
  bassBoost:   { enabled: boolean; amount: number }   // 0–15 dB low-shelf at 100 Hz
  treble:      { enabled: boolean; amount: number }   // 0–12 dB high-shelf at 8 kHz
  stereoWidth: { enabled: boolean; amount: number }   // 0–200 (100 = normal stereo)
  reverb:      { enabled: boolean; mix: number; roomSize: number } // mix 0–100 %, room 0–100 %
  crossfeed:   { enabled: boolean; amount: number }   // 0–100 %
  limiter:     { enabled: boolean; threshold: number } // -24..0 dB
}

// ── Persisted settings ───────────────────────────────────────────────────────

export interface EqSettings {
  enabled: boolean
  gains: number[]        // dB, one per EQ_BANDS
  preampGain: number     // dB, applied before the chain
}

export interface MbBandSettings {
  threshold: number   // dB  -60..0
  ratio: number       // 1..20
  attack: number      // ms  0..200
  release: number     // ms  50..2000
  makeupGain: number  // dB  -12..+12
  enabled: boolean
}

export interface MbSettings {
  enabled: boolean
  bands: MbBandSettings[]
}

function defaultFx(): FxSettings {
  return {
    bassBoost:   { enabled: false, amount: 6 },
    treble:      { enabled: false, amount: 4 },
    stereoWidth: { enabled: false, amount: 100 },
    reverb:      { enabled: false, mix: 20, roomSize: 50 },
    crossfeed:   { enabled: false, amount: 30 },
    limiter:     { enabled: false, threshold: -3 },
  }
}

function loadFx(): FxSettings {
  try { return { ...defaultFx(), ...JSON.parse(localStorage.getItem('nyro-fx') ?? '') } } catch { return defaultFx() }
}
function saveFx(s: FxSettings) { localStorage.setItem('nyro-fx', JSON.stringify(s)) }

function defaultEq(): EqSettings {
  return { enabled: false, gains: EQ_BANDS.map(() => 0), preampGain: 0 }
}

function defaultMb(): MbSettings {
  return {
    enabled: false,
    bands: MB_BANDS.map(() => ({
      threshold: -24, ratio: 4, attack: 10, release: 200, makeupGain: 0, enabled: true
    }))
  }
}

function loadEq(): EqSettings {
  try { return JSON.parse(localStorage.getItem('nyro-eq') ?? '') } catch { return defaultEq() }
}

function loadMb(): MbSettings {
  try { return JSON.parse(localStorage.getItem('nyro-mb') ?? '') } catch { return defaultMb() }
}

function saveEq(s: EqSettings) { localStorage.setItem('nyro-eq', JSON.stringify(s)) }
function saveMb(s: MbSettings) { localStorage.setItem('nyro-mb', JSON.stringify(s)) }

// ── Engine ───────────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null
let source: MediaElementAudioSourceNode | null = null

// EQ nodes
let preampNode:  GainNode | null = null
let eqBypass:    GainNode | null = null
let eqFilters:   BiquadFilterNode[] = []

// MB compressor nodes
let mbInput:       GainNode | null = null
let mbBandNodes: Array<{ hpf: BiquadFilterNode | null; lpf: BiquadFilterNode | null; comp: DynamicsCompressorNode; makeup: GainNode }> = []
let mbMerge:       GainNode | null = null
let mbDirectGain:  GainNode | null = null  // direct path when MB is bypassed
let mbBypass:      GainNode | null = null

// FX nodes (inserted after mbBypass, before analyser)
let bassFilter:   BiquadFilterNode | null = null
let trebleFilter: BiquadFilterNode | null = null

// Stereo width — M/S via channel splitter+merger
let swSplitter: ChannelSplitterNode | null = null
let swGainLL:   GainNode | null = null
let swGainRR:   GainNode | null = null
let swGainLR:   GainNode | null = null  // L→R cross
let swGainRL:   GainNode | null = null  // R→L cross
let swMerger:   ChannelMergerNode | null = null

// Reverb
let reverbDry:  GainNode | null = null
let reverbWet:  GainNode | null = null
let reverbConv: ConvolverNode | null = null
let reverbSum:  GainNode | null = null

// Crossfeed (headphone speaker simulation)
let cfSplitter: ChannelSplitterNode | null = null
let cfLpfL:     BiquadFilterNode | null = null
let cfLpfR:     BiquadFilterNode | null = null
let cfDelayL:   DelayNode | null = null
let cfDelayR:   DelayNode | null = null
let cfGainLR:   GainNode | null = null
let cfGainRL:   GainNode | null = null
let cfMerger:   ChannelMergerNode | null = null
let cfDry:      GainNode | null = null
let cfSum:      GainNode | null = null

// Limiter
let limiterNode: DynamicsCompressorNode | null = null

// Spectrum analyser
let analyserNode: AnalyserNode | null = null

export function getAnalyser(): AnalyserNode | null { return analyserNode }

// Reactive settings
export const eqSettings = reactive<EqSettings>(loadEq())
export const mbSettings = reactive<MbSettings>(loadMb())
export const fxSettings = reactive<FxSettings>(loadFx())

// Ensure arrays are the right length after a schema change
if (eqSettings.gains.length !== EQ_BANDS.length) eqSettings.gains = EQ_BANDS.map(() => 0)
if (mbSettings.bands.length !== MB_BANDS.length)  mbSettings.bands = MB_BANDS.map(() => ({ threshold: -24, ratio: 4, attack: 10, release: 200, makeupGain: 0, enabled: true }))

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

// ── Build the node graph ──────────────────────────────────────────────────────

function ensureEqFilters() {
  if (eqFilters.length) return
  const c = getCtx()
  eqFilters = EQ_BANDS.map((def, i) => {
    const f = c.createBiquadFilter()
    f.type = def.type
    f.frequency.value = def.freq
    f.Q.value = def.Q
    f.gain.value = eqSettings.gains[i]
    return f
  })
}

function buildGraph(audioEl: HTMLAudioElement) {
  const c = getCtx()

  if (source) return   // already connected

  source    = c.createMediaElementSource(audioEl)
  preampNode = c.createGain()
  eqBypass  = c.createGain()
  mbInput   = c.createGain()
  mbMerge   = c.createGain()
  mbBypass  = c.createGain()

  // ── EQ filter chain ──────────────────────────────────────────────
  ensureEqFilters()
  EQ_BANDS.forEach((def, i) => {
    const f = eqFilters[i]
    f.type = def.type
    f.frequency.value = def.freq
    f.Q.value = def.Q
    f.gain.value = eqSettings.gains[i]
  })

  // source → preamp → [chain of EQ filters] → eqBypass → mbInput
  source.connect(preampNode)
  let node: AudioNode = preampNode
  for (const f of eqFilters) { node.connect(f); node = f }
  node.connect(eqBypass)
  eqBypass.connect(mbInput)

  // ── Multiband compressor ──────────────────────────────────────────
  // Direct bypass path: used when MB is disabled
  mbDirectGain = c.createGain()
  mbDirectGain.gain.value = mbSettings.enabled ? 0 : 1
  mbInput.connect(mbDirectGain)
  mbDirectGain.connect(mbMerge!)

  mbBandNodes = MB_BANDS.map((def, i) => {
    const bs = mbSettings.bands[i]

    const comp = c.createDynamicsCompressor()
    comp.threshold.value = bs.threshold
    comp.ratio.value     = bs.ratio
    comp.attack.value    = bs.attack   / 1000
    comp.release.value   = bs.release  / 1000

    const makeup = c.createGain()
    // When MB is disabled at startup, band gains are 0
    makeup.gain.value = mbSettings.enabled ? dbToLinear(bs.makeupGain) : 0

    let hpf: BiquadFilterNode | null = null
    let lpf: BiquadFilterNode | null = null

    if (def.crossLow !== null) {
      hpf = c.createBiquadFilter()
      hpf.type = 'highpass'
      hpf.frequency.value = def.crossLow
      hpf.Q.value = 0.7
    }
    if (def.crossHigh !== null) {
      lpf = c.createBiquadFilter()
      lpf.type = 'lowpass'
      lpf.frequency.value = def.crossHigh
      lpf.Q.value = 0.7
    }

    // mbInput → [hpf →] [lpf →] comp → makeup → mbMerge
    let entry: AudioNode = mbInput!
    if (hpf) { entry.connect(hpf); entry = hpf }
    if (lpf) { entry.connect(lpf); entry = lpf }
    entry.connect(comp)
    comp.connect(makeup)
    makeup.connect(mbMerge!)

    return { hpf, lpf, comp, makeup }
  })

  // ── FX chain ──────────────────────────────────────────────

  // Bass boost & treble (series biquad filters)
  bassFilter   = c.createBiquadFilter()
  bassFilter.type = 'lowshelf'
  bassFilter.frequency.value = 100
  bassFilter.gain.value = 0

  trebleFilter = c.createBiquadFilter()
  trebleFilter.type = 'highshelf'
  trebleFilter.frequency.value = 8000
  trebleFilter.gain.value = 0

  // Stereo widener (M/S via channel routing)
  swSplitter = c.createChannelSplitter(2)
  swGainLL   = c.createGain()
  swGainRR   = c.createGain()
  swGainLR   = c.createGain()
  swGainRL   = c.createGain()
  swMerger   = c.createChannelMerger(2)

  swSplitter.connect(swGainLL, 0); swGainLL.connect(swMerger, 0, 0)  // L→L
  swSplitter.connect(swGainRR, 1); swGainRR.connect(swMerger, 0, 1)  // R→R
  swSplitter.connect(swGainLR, 0); swGainLR.connect(swMerger, 0, 1)  // L→R cross
  swSplitter.connect(swGainRL, 1); swGainRL.connect(swMerger, 0, 0)  // R→L cross

  // Reverb (dry + wet convolver in parallel)
  reverbDry  = c.createGain()
  reverbWet  = c.createGain()
  reverbConv = c.createConvolver()
  reverbSum  = c.createGain()
  reverbDry.gain.value = 1
  reverbWet.gain.value = 0

  // Crossfeed (LPF + short delay cross-mix for headphones)
  cfSplitter = c.createChannelSplitter(2)
  cfLpfL     = c.createBiquadFilter(); cfLpfL.type = 'lowpass'; cfLpfL.frequency.value = 700
  cfLpfR     = c.createBiquadFilter(); cfLpfR.type = 'lowpass'; cfLpfR.frequency.value = 700
  cfDelayL   = c.createDelay(0.05); cfDelayL.delayTime.value = 0.0003
  cfDelayR   = c.createDelay(0.05); cfDelayR.delayTime.value = 0.0003
  cfGainLR   = c.createGain(); cfGainLR.gain.value = 0
  cfGainRL   = c.createGain(); cfGainRL.gain.value = 0
  cfDry      = c.createGain()
  cfSum      = c.createGain()
  cfMerger   = c.createChannelMerger(2)

  cfSplitter.connect(cfLpfL, 0); cfLpfL.connect(cfDelayL); cfDelayL.connect(cfGainLR)
  cfSplitter.connect(cfLpfR, 1); cfLpfR.connect(cfDelayR); cfDelayR.connect(cfGainRL)

  // Limiter (extreme compressor settings)
  limiterNode = c.createDynamicsCompressor()
  limiterNode.knee.value     = 3
  limiterNode.ratio.value    = 20
  limiterNode.attack.value   = 0.003
  limiterNode.release.value  = 0.1
  limiterNode.threshold.value = 0  // will be overridden

  analyserNode = c.createAnalyser()
  analyserNode.fftSize = 128
  analyserNode.smoothingTimeConstant = 0.75
  analyserNode.minDecibels = -90
  analyserNode.maxDecibels = -10

  // Wire: mbBypass → bass → treble → swSplitter → swMerger → reverbDry/Wet → reverbSum → cfDry/cross → cfSum/Merger → limiter → analyser → dest
  mbMerge.connect(mbBypass)
  mbBypass.connect(bassFilter)
  bassFilter.connect(trebleFilter)
  trebleFilter.connect(swSplitter)
  swMerger.connect(reverbDry)
  swMerger.connect(reverbConv)
  reverbConv.connect(reverbWet)
  reverbDry.connect(reverbSum)
  reverbWet.connect(reverbSum)
  reverbSum.connect(cfSplitter)
  reverbSum.connect(cfDry)
  cfGainLR.connect(cfMerger, 0, 1)  // L cross → R
  cfGainRL.connect(cfMerger, 0, 0)  // R cross → L
  cfDry.connect(cfSum)
  cfMerger.connect(cfSum)
  cfSum.connect(limiterNode)
  limiterNode.connect(analyserNode)
  analyserNode.connect(c.destination)

  applyEqEnabled()
  applyMbEnabled()
  applyPreamp()
  applyFxAll()
}

// ── Apply helpers ────────────────────────────────────────────────────────────

function dbToLinear(db: number) { return Math.pow(10, db / 20) }

export function applyPreamp() {
  if (!preampNode) return
  preampNode.gain.value = dbToLinear(eqSettings.preampGain)
  saveEq({ ...eqSettings })
}

export function setEqGain(band: number, db: number) {
  eqSettings.gains[band] = db
  if (eqFilters[band]) eqFilters[band].gain.value = db
  saveEq({ ...eqSettings })
}

export function applyEqEnabled() {
  // When disabled, bypass all filters by setting their gains to 0 without
  // disconnecting (avoids audio glitches from topology changes)
  if (!ctx) return
  eqFilters.forEach((f, i) => {
    f.gain.value = eqSettings.enabled ? eqSettings.gains[i] : 0
  })
  if (preampNode) preampNode.gain.value = eqSettings.enabled ? dbToLinear(eqSettings.preampGain) : 1
  saveEq({ ...eqSettings })
}

export function applyMbEnabled() {
  if (mbDirectGain) mbDirectGain.gain.value = mbSettings.enabled ? 0 : 1
  if (mbBandNodes.length) {
    mbBandNodes.forEach((nodes, i) => {
      const bs = mbSettings.bands[i]
      nodes.makeup.gain.value = mbSettings.enabled && bs.enabled ? dbToLinear(bs.makeupGain) : 0
    })
  }
  saveMb({ ...mbSettings })
}

export function setMbParam(
  band: number,
  param: keyof MbBandSettings,
  value: number | boolean
) {
  ;(mbSettings.bands[band] as any)[param] = value
  const nodes = mbBandNodes[band]
  if (!nodes) return
  const bs = mbSettings.bands[band]
  if (param === 'threshold') nodes.comp.threshold.value = value as number
  if (param === 'ratio')     nodes.comp.ratio.value     = value as number
  if (param === 'attack')    nodes.comp.attack.value    = (value as number) / 1000
  if (param === 'release')   nodes.comp.release.value   = (value as number) / 1000
  if (param === 'makeupGain') nodes.makeup.gain.value   = dbToLinear(value as number)
  if (param === 'enabled') {
    nodes.makeup.gain.value = mbSettings.enabled && bs.enabled ? dbToLinear(bs.makeupGain) : 0
  }
  saveMb({ ...mbSettings })
}

// ── Frequency response for EQ canvas ────────────────────────────────────────

const FREQ_POINTS = 512
let freqArray: Float32Array | null = null

function getFreqArray(): Float32Array {
  if (freqArray) return freqArray
  freqArray = new Float32Array(FREQ_POINTS)
  for (let i = 0; i < FREQ_POINTS; i++) {
    // Logarithmic spacing 20Hz–20kHz
    freqArray[i] = 20 * Math.pow(1000, i / (FREQ_POINTS - 1))
  }
  return freqArray
}

export function getEqResponse(): Float32Array {
  ensureEqFilters()
  const freqs = getFreqArray()
  const combined = new Float32Array(FREQ_POINTS).fill(1)
  const mag   = new Float32Array(FREQ_POINTS)
  const phase = new Float32Array(FREQ_POINTS)

  for (const f of eqFilters) {
    f.getFrequencyResponse(freqs, mag, phase)
    for (let i = 0; i < FREQ_POINTS; i++) combined[i] *= mag[i]
  }
  // Preamp
  const preampLin = dbToLinear(eqSettings.enabled ? eqSettings.preampGain : 0)
  for (let i = 0; i < FREQ_POINTS; i++) combined[i] *= preampLin

  return combined
}

export function getFreqArray_public() { return getFreqArray() }

// ── FX apply functions ───────────────────────────────────────────────────────

function generateReverbIR(c: AudioContext, roomSize: number): AudioBuffer {
  const sampleRate = c.sampleRate
  const duration   = 0.5 + roomSize * 3.5   // 0.5s–4s
  const decay      = 1 + roomSize * 5        // decay exponent
  const len        = Math.floor(sampleRate * duration)
  const buf        = c.createBuffer(2, len, sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
  }
  return buf
}

export function applyFxBassBoost() {
  if (!bassFilter) return
  bassFilter.gain.value = fxSettings.bassBoost.enabled ? fxSettings.bassBoost.amount : 0
  saveFx({ ...fxSettings })
}

export function applyFxTreble() {
  if (!trebleFilter) return
  trebleFilter.gain.value = fxSettings.treble.enabled ? fxSettings.treble.amount : 0
  saveFx({ ...fxSettings })
}

export function applyFxStereoWidth() {
  if (!swGainLL || !swGainRR || !swGainLR || !swGainRL) return
  const w = fxSettings.stereoWidth.enabled ? fxSettings.stereoWidth.amount / 100 : 1
  swGainLL.gain.value = (1 + w) / 2
  swGainRR.gain.value = (1 + w) / 2
  swGainLR.gain.value = (1 - w) / 2
  swGainRL.gain.value = (1 - w) / 2
  saveFx({ ...fxSettings })
}

export function applyFxReverb() {
  if (!reverbDry || !reverbWet || !reverbConv) return
  const c = getCtx()
  const mix = fxSettings.reverb.enabled ? fxSettings.reverb.mix / 100 : 0
  reverbDry.gain.value = 1 - mix * 0.5
  reverbWet.gain.value = mix
  if (fxSettings.reverb.enabled) {
    reverbConv.buffer = generateReverbIR(c, fxSettings.reverb.roomSize / 100)
  }
  saveFx({ ...fxSettings })
}

export function applyFxCrossfeed() {
  if (!cfGainLR || !cfGainRL) return
  const amount = fxSettings.crossfeed.enabled ? fxSettings.crossfeed.amount / 100 * 0.45 : 0
  cfGainLR.gain.value = amount
  cfGainRL.gain.value = amount
  saveFx({ ...fxSettings })
}

export function applyFxLimiter() {
  if (!limiterNode) return
  limiterNode.threshold.value = fxSettings.limiter.enabled ? fxSettings.limiter.threshold : 0
  limiterNode.ratio.value     = fxSettings.limiter.enabled ? 20 : 1
  saveFx({ ...fxSettings })
}

export function applyFxAll() {
  applyFxBassBoost()
  applyFxTreble()
  applyFxStereoWidth()
  applyFxReverb()
  applyFxCrossfeed()
  applyFxLimiter()
}

// ── Connect / resume ─────────────────────────────────────────────────────────

export function connectAudioElement(el: HTMLAudioElement) {
  buildGraph(el)
  // AudioContext might be suspended if created before a user gesture
  if (ctx?.state === 'suspended') ctx.resume()
}

export function resumeContext() {
  if (ctx?.state === 'suspended') ctx.resume()
}
