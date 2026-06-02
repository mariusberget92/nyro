<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { getAnalyser } from '../composables/audioEngine'

const props = defineProps<{ playing: boolean }>()

const canvas = ref<HTMLCanvasElement | null>(null)
let raf = 0

function draw() {
  const analyser = getAnalyser()
  const c = canvas.value
  if (!c) return

  const W = c.width  = c.offsetWidth
  const H = c.height = c.offsetHeight
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, W, H)

  if (!analyser) {
    raf = requestAnimationFrame(draw)
    return
  }

  const binCount = analyser.frequencyBinCount   // fftSize / 2 = 64
  const data = new Uint8Array(binCount)
  analyser.getByteFrequencyData(data)

  // Skip the lowest 2 bins (DC / sub-bass rumble) and top bins (mostly noise)
  const start = 2
  const end   = Math.floor(binCount * 0.82)
  const bars  = end - start
  const barW  = W / bars
  const gap   = Math.max(1, barW * 0.15)

  for (let i = 0; i < bars; i++) {
    const v   = data[start + i] / 255          // 0–1
    const bH  = Math.max(2, v * H * 0.92)
    const x   = i * barW
    // Gradient: accent at top, faded at bottom
    const grad = ctx.createLinearGradient(0, H - bH, 0, H)
    grad.addColorStop(0,   `rgba(61,127,255,${0.85 * v + 0.1})`)
    grad.addColorStop(0.6, `rgba(61,127,255,${0.35 * v + 0.05})`)
    grad.addColorStop(1,   `rgba(61,127,255,0.04)`)
    ctx.fillStyle = grad
    ctx.fillRect(x + gap / 2, H - bH, barW - gap, bH)
  }

  raf = requestAnimationFrame(draw)
}

function start() { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw) }
function stop()  { cancelAnimationFrame(raf); const c = canvas.value; if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height) }

watch(() => props.playing, v => v ? start() : stop(), { immediate: true })

onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <canvas ref="canvas" class="viz-canvas" />
</template>

<style scoped>
.viz-canvas {
  width: 100%;
  height: 38px;
  display: block;
  pointer-events: none;
}
</style>
