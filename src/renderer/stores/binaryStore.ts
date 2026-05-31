import { defineStore } from 'pinia'

export const useBinaryStore = defineStore('binary', {
  state: () => ({
    checking: true,
    ytdlpOk: false,
    ffmpegOk: false,
    ytdlpVersion: null as string | null,
    ffmpegVersion: null as string | null,
  }),
  actions: {
    setStatus(payload: {
      ytdlpFound: boolean
      ffmpegMissing: boolean
      ytdlpVersion: string | null
      ffmpegVersion: string | null
    }) {
      this.checking = false
      this.ytdlpOk = payload.ytdlpFound
      this.ffmpegOk = !payload.ffmpegMissing
      this.ytdlpVersion = payload.ytdlpVersion
      this.ffmpegVersion = payload.ffmpegVersion
    },
  },
})
