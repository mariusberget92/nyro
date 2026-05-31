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
  { label: 'Low',      color: '#88c0d0', crossLow: null, crossHigh: 250  },
  { label: 'Low-Mid',  color: '#a3be8c', crossLow: 250,  crossHigh: 2000 },
  { label: 'High-Mid', color: '#ebcb8b', crossLow: 2000, crossHigh: 8000 },
  { label: 'High',     color: '#b48ead', crossLow: 8000, crossHigh: null },
]

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
let eqBypass:    GainNode | null = null          // bypasses EQ when disabled
let eqFilters:   BiquadFilterNode[] = []

// MB compressor nodes
let mbInput:     GainNode | null = null
let mbBandNodes: Array<{ hpf: BiquadFilterNode | null; lpf: BiquadFilterNode | null; comp: DynamicsCompressorNode; makeup: GainNode }> = []
let mbMerge:     GainNode | null = null
let mbBypass:    GainNode | null = null

// Reactive settings (the UI binds to these)
export const eqSettings = reactive<EqSettings>(loadEq())
export const mbSettings = reactive<MbSettings>(loadMb())

// Ensure arrays are the right length after a schema change
if (eqSettings.gains.length !== EQ_BANDS.length) eqSettings.gains = EQ_BANDS.map(() => 0)
if (mbSettings.bands.length !== MB_BANDS.length)  mbSettings.bands = MB_BANDS.map(() => ({ threshold: -24, ratio: 4, attack: 10, release: 200, makeupGain: 0, enabled: true }))

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

// ── Build the node graph ──────────────────────────────────────────────────────

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
  eqFilters = EQ_BANDS.map((def, i) => {
    const f = c.createBiquadFilter()
    f.type = def.type
    f.frequency.value = def.freq
    f.Q.value = def.Q
    f.gain.value = eqSettings.gains[i]
    return f
  })

  // source → preamp → [chain of EQ filters] → eqBypass → mbInput
  source.connect(preampNode)
  let node: AudioNode = preampNode
  for (const f of eqFilters) { node.connect(f); node = f }
  node.connect(eqBypass)
  eqBypass.connect(mbInput)

  // ── Multiband compressor ──────────────────────────────────────────
  mbBandNodes = MB_BANDS.map((def, i) => {
    const bs = mbSettings.bands[i]

    const comp = c.createDynamicsCompressor()
    comp.threshold.value = bs.threshold
    comp.ratio.value     = bs.ratio
    comp.attack.value    = bs.attack   / 1000
    comp.release.value   = bs.release  / 1000

    const makeup = c.createGain()
    makeup.gain.value = dbToLinear(bs.makeupGain)

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

  mbMerge.connect(mbBypass)
  mbBypass.connect(c.destination)

  applyEqEnabled()
  applyMbEnabled()
  applyPreamp()
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
    // Mute disabled band by setting makeup gain to 0
    nodes.makeup.gain.value = bs.enabled ? dbToLinear(bs.makeupGain) : 0
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

// ── Connect / resume ─────────────────────────────────────────────────────────

export function connectAudioElement(el: HTMLAudioElement) {
  buildGraph(el)
  // AudioContext might be suspended if created before a user gesture
  if (ctx?.state === 'suspended') ctx.resume()
}

export function resumeContext() {
  if (ctx?.state === 'suspended') ctx.resume()
}
