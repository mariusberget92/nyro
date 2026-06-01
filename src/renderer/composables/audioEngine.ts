// Minimal audio engine — provides only the AnalyserNode for the visualizer.
// No EQ, no processing; audio plays through unmodified.

let ctx: AudioContext | null = null
let source: MediaElementAudioSourceNode | null = null
let analyserNode: AnalyserNode | null = null

export function connectAudioElement(el: HTMLAudioElement) {
  if (source) return
  ctx = new AudioContext()
  source = ctx.createMediaElementSource(el)
  analyserNode = ctx.createAnalyser()
  analyserNode.fftSize = 128
  analyserNode.smoothingTimeConstant = 0.75
  source.connect(analyserNode)
  analyserNode.connect(ctx.destination)
  if (ctx.state === 'suspended') ctx.resume()
}

export function resumeContext() {
  if (ctx?.state === 'suspended') ctx.resume()
}

export function getAnalyser(): AnalyserNode | null {
  return analyserNode
}
