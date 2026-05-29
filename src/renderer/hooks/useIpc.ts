import { useEffect } from 'react'
import type { IpcOnChannels } from '@shared/types/ipc'

type OnChannel = keyof IpcOnChannels

/**
 * Subscribe to a main→renderer IPC channel.
 * Automatically unsubscribes on unmount.
 */
export function useIpc<C extends OnChannel>(
  channel: C,
  listener: (payload: IpcOnChannels[C]) => void
): void {
  useEffect(() => {
    const unsubscribe = window.nyro.on(channel, listener)
    return unsubscribe
  }, [channel, listener])
}
