import { ref, readonly } from 'vue'
import { createCloudLibrary, matchCloudFiles, validateCloudDownload } from '~/utils/neteaseCloud'
import type { NeteaseCloudFile } from '~/utils/neteaseCloud'
import { getSyncedTimestamp } from '~/composables/useSyncedTime'
import { useLocale } from '~/utils/locale'
import { useLocaleText } from '~/composables/useLocaleText'
import { playbackAbortError, withPlaybackSignal } from '~/utils/playbackRequest'

export type PlaybackNotificationWindow = Window & {
  $showNotification?: (message: string, type: string) => void
}

export type CloudPlaybackOptions = {
  neteaseMode?: 'auto' | 'cloud' | 'catalog'
  cloudFileKey?: string
  catalogCloudFiles?: NeteaseCloudFile[]
  skipCloudProbe?: boolean
  preload?: boolean
  signal?: AbortSignal
  onWaitingForSelection?: (waiting: boolean) => void
  musicInfo?: { rawItem?: unknown }
}

const pendingSelection = ref<{ files: NeteaseCloudFile[]; musicId: string } | null>(null)
let completeSelection: ((file: NeteaseCloudFile | null) => void) | null = null
let session = ''
let sessionGeneration = 0
let selectionGeneration = 0
const choices = new Map<string, string>()
const library = createCloudLibrary((offset, cookie) => $fetch<unknown, string>('/api/api-enhanced/netease/user/cloud', {
  params: { offset, limit: 1000, cookie, timestamp: getSyncedTimestamp() }, timeout: 12000
}), getSyncedTimestamp)

export function invalidateNeteaseCloud() {
  if (import.meta.server) return
  session = ''
  sessionGeneration++
  library.reset()
  choices.clear()
  completeSelection?.(null)
  selectionGeneration++
  completeSelection = null
  pendingSelection.value = null
}

const cloudError = (files?: NeteaseCloudFile[], file?: NeteaseCloudFile) => Object.assign(new Error('云盘原文件解析失败'), {
  data: { code: 'MUSIC_CLOUD_PLAYBACK_FAILED' }, cloudFiles: files, cloudFile: file
})
export const isCloudPlaybackError = (error: any) => error?.data?.code === 'MUSIC_CLOUD_PLAYBACK_FAILED'

export function useNeteaseCloudPlayback() {
  const { audioPlayer } = useLocale()
  const { t } = useLocaleText(audioPlayer)
  const chooseFile = (key?: string) => {
    const file = pendingSelection.value?.files.find(item => item.key === key) || null
    completeSelection?.(file)
  }
  const resolve = async (musicId: string | number, options: CloudPlaybackOptions = {}, suppliedCookie?: string) => {
    if (import.meta.server || options.neteaseMode === 'catalog' || options.skipCloudProbe) return null
    const cookie = suppliedCookie || localStorage.getItem('netease_cookie') || ''
    if (cookie !== session) { invalidateNeteaseCloud(); session = cookie }
    const generation = sessionGeneration
    const assertSession = () => {
      if (generation !== sessionGeneration || session !== cookie ||
          (!suppliedCookie && localStorage.getItem('netease_cookie') !== cookie)) throw playbackAbortError()
    }
    if (!cookie) {
      if (options.neteaseMode === 'cloud') throw cloudError()
      return null
    }
    let files: NeteaseCloudFile[]
    try {
      const all = await withPlaybackSignal(library.load(cookie), options.signal)
      assertSession()
      files = matchCloudFiles(all, musicId, options.musicInfo?.rawItem)
    } catch (error: any) {
      if (options.signal?.aborted || error?.name === 'AbortError') throw error
      if (options.neteaseMode === 'cloud') throw cloudError()
      if (!options.preload) (window as PlaybackNotificationWindow).$showNotification?.(t('cloudLookupFailed'), 'warning')
      return null
    }
    if (!files.length) {
      if (options.neteaseMode === 'cloud') throw cloudError()
      return null
    }
    const selectionKey = String(musicId)
    let file = files.find(item => item.key === (options.cloudFileKey || choices.get(selectionKey)))
    if (!file && options.cloudFileKey) throw cloudError()
    if (!file && files.length === 1) file = files[0]
    if (!file) {
      if (options.preload) return { url: null, source: 'netease-cloud', cloudFiles: files }
      completeSelection?.(null)
      const generation = ++selectionGeneration
      options.onWaitingForSelection?.(true)
      try {
        const selected = new Promise<NeteaseCloudFile | null>(resolveSelection => {
          completeSelection = resolveSelection
          pendingSelection.value = { files, musicId: String(musicId) }
        })
        file = await withPlaybackSignal(selected, options.signal) || undefined
      } finally {
        if (generation === selectionGeneration) {
          completeSelection = null
          pendingSelection.value = null
        }
        options.onWaitingForSelection?.(false)
      }
      if (!file) throw playbackAbortError()
    }
    assertSession()
    choices.set(selectionKey, file.key)
    try {
      const response = await $fetch<unknown, string>('/api/api-enhanced/netease/song/cloud/download', {
        params: { id: file.downloadId, cookie, timestamp: getSyncedTimestamp() },
        signal: options.signal, timeout: 12000
      })
      assertSession()
      return { url: validateCloudDownload(response, file), source: 'netease-cloud', actualQuality: 'cloud', cloudFile: file, cloudFiles: files }
    } catch (error: any) {
      if (options.signal?.aborted || error?.name === 'AbortError') throw error
      console.warn(`[NeteaseCloud] 原文件取链失败 ${JSON.stringify({ downloadId: file.downloadId, validation: error?.cloudValidation, status: error?.statusCode })}`)
      throw cloudError(files, file)
    }
  }
  return { resolve, pendingSelection: readonly(pendingSelection), chooseFile }
}
