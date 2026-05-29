import { contextBridge, ipcRenderer } from 'electron'
import type { IpcInvokeChannels, IpcOnChannels } from '@shared/types/ipc'

type InvokeChannel = keyof IpcInvokeChannels
type OnChannel = keyof IpcOnChannels

type UnsubscribeFn = () => void

const nyroApi = {
  invoke<C extends InvokeChannel>(
    channel: C,
    ...args: Parameters<IpcInvokeChannels[C]>
  ): ReturnType<IpcInvokeChannels[C]> {
    return ipcRenderer.invoke(channel, ...args) as ReturnType<IpcInvokeChannels[C]>
  },

  on<C extends OnChannel>(
    channel: C,
    listener: (payload: IpcOnChannels[C]) => void
  ): UnsubscribeFn {
    const handler = (_event: Electron.IpcRendererEvent, payload: IpcOnChannels[C]) => {
      listener(payload)
    }
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

contextBridge.exposeInMainWorld('nyro', nyroApi)

export type NyroApi = typeof nyroApi
