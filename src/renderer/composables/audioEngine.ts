// Minimal audio engine — provides only the AnalyserNode for the visualizer.
// No EQ, no processing; audio plays through unmodified.
let source: MediaElementAudioSourceNode | null = null
let analyserNode: AnalyserNode | null = null

export function connectAudioElement(el: HTMLAudioElement) {
}

export function resumeContext() {
  if (ctx?.state === 'suspended') ctx.resume()
}

export function getAnalyser(): AnalyserNode | null {
  return analyserNode
}
