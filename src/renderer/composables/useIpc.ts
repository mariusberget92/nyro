import { onMounted, onUnmounted } from 'vue'

export function useIpc(channel: string, handler: (payload: unknown) => void) {
  let unsub: (() => void) | null = null
  onMounted(() => {
    if (window.nyro) unsub = window.nyro.on(channel, handler)
  })
  onUnmounted(() => { unsub?.() })
}
