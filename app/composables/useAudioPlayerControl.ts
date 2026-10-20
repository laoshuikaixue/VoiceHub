import { computed, nextTick, ref } from 'vue'
import { useAudioQuality } from '~/composables/useAudioQuality'
import { useLyrics } from '~/composables/useLyrics'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useLocale } from '~/utils/locale'
import { getMusicUrlResult } from '~/utils/musicUrl'
import type { MusicTrackMeta, MusicUrlResolveResult, MusicUrlResolveOptions } from '~/utils/musicUrl'
import { createPlaybackRequest, withPlaybackSignal, playbackAbortError } from '~/utils/playbackRequest'
import { useServerErrors, useLocaleText } from '~/composables/useLocaleText'
import type { PlaybackNotificationWindow } from '~/composables/useNeteaseCloudPlayback'

/**
 * 音量持久化：仅记录最后一次非 0 音量，静音属于瞬时状态不落盘，
 * 避免刷新后出现「看起来在播但没声音」
 */
const VOLUME_STORAGE_KEY = 'voicehub_player_volume'

const clampVolume = (value: number): number => Math.max(0, Math.min(1, value))

/** 将感知音量位置转换为线性增益 */
export const volumePositionToGain = (position: number): number =>
  Math.max(0, Math.min(1, position)) ** 3

/** 将线性增益转换为感知音量位置，保留已有存档的实际响度 */
export const volumeGainToPosition = (gain: number): number =>
  Math.cbrt(Math.max(0, Math.min(1, gain)))

const readStoredVolume = (): number => {
  if (!import.meta.client) return 1
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY)
    if (raw === null) return 1
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return 1
    return clampVolume(parsed)
  } catch {
    return 1
  }
}

const persistVolume = (value: number) => {
  if (!import.meta.client) return
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, String(value))
  } catch {
    // 隐私模式 / 配额不足时写入失败不影响播放
  }
}

// 单例状态
const audioPlayer = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const progress = ref(0)
const currentTime = ref(0)
const duration = ref(0)
const initialVolume = readStoredVolume()
const volume = ref(initialVolume) // 0.0 到 1.0
const isMuted = ref(false)
const preMuteVolume = ref(initialVolume)
const hasError = ref(false)
const coverError = ref(false)
const showQualitySettings = ref(false)

// 拖拽状态
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartProgress = ref(0)
const dragProgress = ref(0)

// 同步状态
const isSyncingFromGlobal = ref(false)
const isLoadingNewSong = ref(false)
const isLoadingTrack = ref(false)
const playbackInfo = ref<MusicUrlResolveResult | null>(null)
const lastLoadError = ref<any>(null)
let loadGeneration = 0
let activeRequest: ReturnType<typeof createPlaybackRequest> | null = null
let playbackIdentity = ''
let playbackOptions: MusicUrlResolveOptions = {}
const progressBarRef = ref<HTMLElement | null>(null)
const hasUserInteracted = ref(false)

// 播放模式: 'off' (单曲播放完退出) | 'order' (顺序播放列表) | 'loopOne' (单曲循环)
const playMode = ref<'off' | 'order' | 'loopOne'>('order')

// 共享歌词实例
const lyrics = useLyrics()

export const useAudioPlayerControl = () => {
  const { audioPlayer: audioPlayerLocale } = useLocale()
  const { localize } = useServerErrors()
  const { t } = useLocaleText(audioPlayerLocale)
  // 音质 (Composable 使用应在 setup/function 内部)
  const { getQualityLabel, getQuality, getQualityOptions, saveQuality } = useAudioQuality()

  // 全局音频播放器
  const globalAudioPlayer = useAudioPlayer()

  // 基本播放控制
  const play = async (): Promise<boolean> => {
    const generation = loadGeneration
    // 等待音频播放器引用设置完成
    let retryCount = 0
    const maxRetries = 20

    while (!audioPlayer.value && retryCount < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      retryCount++
    }

    if (!audioPlayer.value || hasError.value) {
      isLoadingTrack.value = false
      return false
    }

    if (!audioPlayer.value.getAttribute('src') && !isLoadingNewSong.value) {
      const song = globalAudioPlayer.getCurrentSong().value
      if (song?.musicPlatform === 'netease') return loadSong(song)
    }

    try {
      // 确保音频已经加载
      if (audioPlayer.value.readyState < 2) {
        await waitForCanPlay(audioPlayer.value)
      }

      if (generation !== loadGeneration) return false
      // 设置音频属性以支持自动播放
      audioPlayer.value.autoplay = true
      audioPlayer.value.preload = 'auto'

      const playPromise = audioPlayer.value.play()

      // 处理播放 Promise
      if (playPromise !== undefined) {
        await playPromise
      }
      return true
    } catch (error) {
      if (generation !== loadGeneration) return false
      isLoadingTrack.value = false
      isLoadingNewSong.value = false
      isPlaying.value = false
      // 检查是否是自动播放被阻止的错误
      if (error.name === 'NotAllowedError') {
        console.warn('[AudioPlayerControl] ⚠️ 自动播放被浏览器阻止，需要用户交互')
        if (typeof window !== 'undefined' && window.$showNotification) {
          window.$showNotification(audioPlayerLocale.value.autoplayBlocked, 'info')
        }
        // 不设置 hasError，因为这不是真正的错误
        return false
      } else {
        console.error('[AudioPlayerControl] ❌ 播放失败:', error)
        hasError.value = true
        return false
      }
    }
  }

  const pause = (): boolean => {
    if (!audioPlayer.value) {
      console.warn('[AudioPlayerControl] pause called but audioPlayer is null')
      return false
    }

    try {
      audioPlayer.value.pause()
      return true
    } catch (error) {
      console.error('暂停失败:', error)
      return false
    }
  }

  const stop = (): boolean => {
    loadGeneration++
    activeRequest?.cancel()
    activeRequest = null
    isLoadingNewSong.value = false
    isLoadingTrack.value = false
    if (!audioPlayer.value) return false

    try {
      audioPlayer.value.pause()
      audioPlayer.value.src = ''
      audioPlayer.value.load()

      // 清理歌词状态
      lyrics.clearLyrics()
      resetState()

      return true
    } catch (error) {
      console.error('停止失败:', error)
      return false
    }
  }

  const seek = async (timeInSeconds: number): Promise<boolean> => {
    if (!audioPlayer.value) return false

    try {
      // 如果 duration 为 0，可能元数据还未加载，直接使用传入时间
      const maxTime = duration.value > 0 ? duration.value : timeInSeconds + 1000
      const targetTime = Math.max(0, Math.min(timeInSeconds, maxTime))

      audioPlayer.value.currentTime = targetTime
      currentTime.value = targetTime
      if (duration.value > 0) {
        progress.value = (targetTime / duration.value) * 100
      }
      return true
    } catch (error) {
      console.error('跳转失败:', error)
      return false
    }
  }

  // 抽象后的 seekAndPlay 方法
  const seekAndPlay = async (timeInSeconds: number) => {
    if (!audioPlayer.value) return

    // 1. 跳转
    await seek(timeInSeconds)

    // 2. 如果暂停则播放
    try {
      await audioPlayer.value.play()
    } catch (e) {
      console.warn('Play failed:', e)
    }

    // 3. 与全局音频播放器同步状态
    globalAudioPlayer.setPosition(timeInSeconds)
    if (!globalAudioPlayer.getPlayingStatus().value) {
      const current = globalAudioPlayer.getCurrentSong().value
      if (current) {
        globalAudioPlayer.playSong(current)
      }
    }
  }

  // 媒体事件监听必须随请求取消清理，不能让旧 canplay 影响新歌曲。
  const waitForCanPlay = (audio: HTMLAudioElement, signal = activeRequest?.signal): Promise<void> => {
    if (signal?.aborted) return Promise.reject(signal.reason || playbackAbortError())
    if (audio.readyState >= 3) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer)
        audio.removeEventListener('canplay', ready)
        audio.removeEventListener('error', failed)
        signal?.removeEventListener('abort', aborted)
      }
      const ready = () => { cleanup(); resolve() }
      const failed = () => { cleanup(); reject(new Error('音频加载失败')) }
      const aborted = () => { cleanup(); reject(signal?.reason || playbackAbortError()) }
      const timer = setTimeout(() => { cleanup(); reject(new DOMException('音频加载超时', 'TimeoutError')) }, 10000)
      audio.addEventListener('canplay', ready)
      audio.addEventListener('error', failed)
      signal?.addEventListener('abort', aborted, { once: true })
    })
  }

  const loadSong = async (song: string | any, override?: MusicUrlResolveOptions): Promise<boolean> => {
    if (!audioPlayer.value) return false
    const identity = typeof song === 'object' ? `${song.musicPlatform}:${song.musicId}:${song.id}` : song
    const switching = identity === playbackIdentity && !!override && !!audioPlayer.value.src && !hasError.value
    if (identity !== playbackIdentity) {
      playbackOptions = {}
      playbackInfo.value = null
    }
    playbackIdentity = identity
    const nextOptions = { ...playbackOptions, ...override }
    if (switching) {
      loadGeneration++
      activeRequest?.cancel()
    } else stop()
    const generation = loadGeneration
    const request = createPlaybackRequest()
    activeRequest = request
    isLoadingNewSong.value = true
    isLoadingTrack.value = true
    hasError.value = false
    lastLoadError.value = null
    if (!switching) lyrics.clearLyrics()
    let committed = false
    try {
      let result: MusicUrlResolveResult
      if (typeof song === 'string') result = { url: song }
      else if (song.musicPlatform && song.musicId && (song.musicPlatform === 'netease' || !song.musicUrl)) {
        result = await getMusicUrlResult(song.musicPlatform, song.musicId, song.playUrl, {
          ...nextOptions,
          catalogCloudFiles: playbackInfo.value?.cloudFiles,
          signal: request.signal,
          musicInfo: { name: song.title, artist: song.artist, album: song.album, rawItem: song },
          onWaitingForSelection(waiting) {
            if (generation !== loadGeneration) return
            isLoadingTrack.value = !waiting
            if (waiting) request.pause(); else request.resume()
          }
        })
      } else result = { url: song.musicUrl || song.playUrl }
      if (generation !== loadGeneration) return false
      if (!result.url) throw new Error('未获取到播放链接')
      if (nextOptions.neteaseMode === 'catalog' && !result.cloudFiles) {
        result.cloudFiles = playbackInfo.value?.cloudFiles
      }
      playbackInfo.value = result
      playbackOptions = nextOptions
      committed = true
      if (switching) lyrics.clearLyrics()
      request.dispose()
      const element = audioPlayer.value
      const resumePosition = switching ? element.currentTime : 0
      const resumePlaying = !element.paused
      element.autoplay = !switching || resumePlaying
      element.src = result.url.trim().replace(/`/g, '')
      element.load()
      await waitForCanPlay(element, request.signal)
      if (generation !== loadGeneration) return false
      if (switching) await seek(resumePosition)
      if (!switching || resumePlaying) {
        await withPlaybackSignal(play(), AbortSignal.any([request.signal, AbortSignal.timeout(10000)]))
      }
      return !hasError.value
    } catch (error: any) {
      if (generation !== loadGeneration) return false
      lastLoadError.value = error
      if (switching && !committed) {
        if (error?.name !== 'AbortError') {
          (window as PlaybackNotificationWindow).$showNotification?.(error?.name === 'TimeoutError'
            ? t('resolveTimeout') : localize(error?.data?.code ? error : { data: { code: 'SONG_OPERATION_FAILED' } }), 'error')
        }
        return false
      }
      audioPlayer.value?.pause()
      if (error?.name === 'AbortError') {
        globalAudioPlayer.pauseSong()
        return false
      }
      hasError.value = true
      isPlaying.value = false
      if (error?.data?.code === 'MUSIC_CLOUD_PLAYBACK_FAILED') {
        playbackInfo.value = { url: null, source: 'netease-cloud', cloudFiles: error.cloudFiles, cloudFile: error.cloudFile }
      }
      (window as PlaybackNotificationWindow).$showNotification?.(error?.name === 'TimeoutError'
        ? t('resolveTimeout') : localize(error?.data?.code ? error : { data: { code: 'SONG_OPERATION_FAILED' } }), 'error')
      return false
    } finally {
      request.dispose()
      if (generation === loadGeneration) {
        isLoadingNewSong.value = false
        isLoadingTrack.value = false
      }
    }
  }

  // 切换播放/暂停
  const togglePlay = async (): Promise<boolean> => {
    if (hasError.value) {
      const song = globalAudioPlayer.getCurrentSong().value
      if (song) return loadSong(song)
    }
    // 标记用户已交互
    hasUserInteracted.value = true

    if (isPlaying.value) {
      return pause()
    } else {
      return await play()
    }
  }

  // 音质切换
  const switchQuality = async (
    platform: string,
    musicId: string,
    qualityValue: string
  ): Promise<boolean> => {
    if (!audioPlayer.value) return false

    // 保存当前播放进度和状态
    const currentTimeBackup = audioPlayer.value.currentTime
    const wasPlaying = isPlaying.value

    // 立即暂停
    if (wasPlaying) {
      pause()
    }

    try {
      // 保存音质设置
      saveQuality(platform, qualityValue)

      // 获取新音质的URL
      const currentSongForQuality = globalAudioPlayer.getCurrentSong().value
      const newUrl = await getMusicUrl(
        platform,
        musicId,
        currentSongForQuality?.playUrl,
        {
          musicInfo: {
            name: currentSongForQuality?.title,
            artist: currentSongForQuality?.artist,
            album: currentSongForQuality?.album || undefined,
            rawItem: currentSongForQuality
          }
        }
      )
      if (!newUrl) {
        throw new Error('获取新音质URL失败')
      }

      // 加载新音频
      const loadSuccess = await loadSong(newUrl)
      if (!loadSuccess) {
        throw new Error('加载新音质失败')
      }

      // 恢复播放进度
      if (currentTimeBackup > 0) {
        await seek(currentTimeBackup)
      }

      // 如果之前在播放，恢复播放状态
      if (wasPlaying) {
        // 先尝试播放，再设置进度，避免自动播放限制
        try {
          await play()
          if (currentTimeBackup > 0) {
            await nextTick()
            await seek(currentTimeBackup)
          }
        } catch (playError) {
          console.warn('恢复播放失败，可能需要用户手动播放:', playError)
        }
      }

      return true
    } catch (error) {
      console.error('切换音质失败:', error)

      // 如果切换失败，尝试恢复之前的播放状态
      if (wasPlaying && !audioPlayer.value.error) {
        try {
          await play()
        } catch (playError) {
          console.error('恢复播放失败:', playError)
        }
      }

      return false
    }
  }

  // 动态获取音乐URL（委托到统一逻辑）
  const getMusicUrl = async (
    platform: string,
    musicId: string,
    playUrl: string | null = null,
    options?: {
      unblock?: boolean
      quality?: number
      musicInfo?: MusicTrackMeta
    }
  ): Promise<string | null> => {
    try {
      const { getMusicUrl: coreGetMusicUrl } = await import('~/utils/musicUrl')
      const url = await coreGetMusicUrl(platform, musicId, playUrl ?? undefined, options)
      return url
    } catch (error) {
      console.error('获取音乐URL错误:', error)
      if (error instanceof TypeError && (error as any).message?.includes('fetch')) {
        throw new Error('网络连接失败，请检查网络连接', { cause: error })
      } else if ((error as any).name === 'AbortError') {
        throw new Error('请求超时，请稍后重试', { cause: error })
      }
      throw error
    }
  }

  // 进度条拖拽
  const startDrag = (event: MouseEvent, progressBar: HTMLElement) => {
    if (event.button !== 0) return

    if (!audioPlayer.value || !progressBar) {
      return
    }

    isDragging.value = true
    dragStartX.value = event.clientX
    dragStartProgress.value = progress.value

    const onDrag = (e: MouseEvent) => {
      if (!isDragging.value || !progressBar) return

      const rect = progressBar.getBoundingClientRect()
      const newX = e.clientX - rect.left
      const percentage = Math.max(0, Math.min(100, (newX / rect.width) * 100))

      progress.value = percentage

      // 拖拽时只更新进度条显示，不实时更新音频位置
      if (duration.value) {
        const newTime = (percentage / 100) * duration.value
        currentTime.value = newTime
      }
    }

    const endDrag = () => {
      isDragging.value = false
      document.removeEventListener('mousemove', onDrag)
      document.removeEventListener('mouseup', endDrag)

      // 拖拽结束时才更新音频位置
      if (audioPlayer.value && duration.value) {
        const newTime = (progress.value / 100) * duration.value
        audioPlayer.value.currentTime = newTime
        currentTime.value = newTime
      }
    }

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', endDrag)
    event.preventDefault()
  }

  // 触摸拖拽
  const startTouchDrag = (event: TouchEvent, progressBar: HTMLElement) => {
    if (event.touches.length !== 1) return

    if (!audioPlayer.value || !progressBar) {
      return
    }

    // 阻止默认行为，防止页面滚动
    event.preventDefault()
    event.stopPropagation()

    isDragging.value = true
    const touch = event.touches[0]
    dragStartX.value = touch.clientX
    dragStartProgress.value = progress.value

    const onTouchDrag = (e: TouchEvent) => {
      if (!isDragging.value || !progressBar || e.touches.length !== 1) return

      // 阻止默认行为和事件冒泡
      e.preventDefault()
      e.stopPropagation()

      const touch = e.touches[0]
      const rect = progressBar.getBoundingClientRect()
      const newX = touch.clientX - rect.left
      const percentage = Math.max(0, Math.min(100, (newX / rect.width) * 100))

      progress.value = percentage

      // 拖拽时只更新进度条显示，不实时更新音频位置
      if (duration.value) {
        const newTime = (percentage / 100) * duration.value
        currentTime.value = newTime
      }
    }

    const endTouchDrag = (e: TouchEvent) => {
      e.preventDefault()
      e.stopPropagation()

      isDragging.value = false
      document.removeEventListener('touchmove', onTouchDrag)
      document.removeEventListener('touchend', endTouchDrag)

      // 触摸结束时才更新音频位置
      if (audioPlayer.value && duration.value) {
        const newTime = (progress.value / 100) * duration.value
        audioPlayer.value.currentTime = newTime
        currentTime.value = newTime
      }
    }

    document.addEventListener('touchmove', onTouchDrag, { passive: false })
    document.addEventListener('touchend', endTouchDrag, { passive: false })
  }

  // 进度条点击跳转
  const seekToPosition = (event: MouseEvent) => {
    if (!audioPlayer.value || isDragging.value) return

    const progressBar = event.currentTarget as HTMLElement
    if (!progressBar) {
      return
    }

    const clickPosition = event.offsetX
    const barWidth = progressBar.clientWidth
    const seekPercentage = clickPosition / barWidth

    const newTime = seekPercentage * duration.value
    seek(newTime)
  }

  // 音质相关计算属性
  const currentQualityText = computed(() => {
    return (platform: string) => {
      if (!platform) return '音质'
      const quality = getQuality(platform)
      const label = getQualityLabel(platform, quality)
      return label.replace(/音质|音乐/, '').trim() || '音质'
    }
  })

  const currentPlatformOptions = computed(() => {
    return (platform: string) => {
      if (!platform) return []
      return getQualityOptions(platform)
    }
  })

  const isCurrentQuality = (platform: string, qualityValue: string) => {
    if (!platform) return false
    return getQuality(platform) === qualityValue
  }

  // 格式化时间
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00'

    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 音频事件处理
  let hasPrefetchedForCurrentSong = false
  
  const onTimeUpdate = (currentTimeValue: number) => {
    if (isDragging.value) return

    currentTime.value = currentTimeValue
    if (duration.value > 0) {
      progress.value = (currentTimeValue / duration.value) * 100
      
      // 距离结束还有15秒时，提前预加载下一首
      if (!hasPrefetchedForCurrentSong && duration.value - currentTimeValue <= 15) {
        hasPrefetchedForCurrentSong = true
        globalAudioPlayer.prefetchNextSong()
      }
    }

    // 更新歌词时间
    const timeInMs = currentTimeValue * 1000
    lyrics.updateCurrentLyricIndex(timeInMs) // 转换为毫秒
  }

  const onLoaded = (durationValue: number) => {
    duration.value = durationValue
    hasError.value = false
    hasPrefetchedForCurrentSong = false // 重置预加载标志
  }

  const onError = (error: any) => {
    // 忽略主动清空 src 或关闭播放器导致的错误
    const audioEl = audioPlayer.value
    if (!audioEl || !audioEl.src || audioEl.src === window.location.href || audioEl.src === window.location.origin + '/') {
      return
    }

    console.error('音频播放错误:', error)

    // 获取更详细的错误信息
    let errorMessage: string
    if (audioPlayer.value && audioPlayer.value.error) {
      const mediaError = audioPlayer.value.error
      switch (mediaError.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = '音频加载被中止'
          break
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = '网络错误，无法加载音频'
          break
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = '音频解码失败，格式不支持'
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = '音频源不支持或无效'
          break
        default:
          errorMessage = `音频播放错误 (代码: ${mediaError.code})`
      }
      console.error(`详细错误信息: ${errorMessage}`, {
        code: mediaError.code,
        message: mediaError.message,
        src: audioPlayer.value.src
      })
    }

    hasError.value = true
    isPlaying.value = false
    isLoadingTrack.value = false
    isLoadingNewSong.value = false

    // 显示用户友好的错误提示
    if (window.$showNotification) {
      window.$showNotification(t('playbackFailed'), 'error')
    }
  }

  const onPlay = () => {
    isPlaying.value = true
    hasError.value = false
    isLoadingTrack.value = false // 音频开始播放时立即清除加载状态
  }

  const onPause = () => {
    isPlaying.value = false
  }

  const onEnded = () => {
    // 根据播放模式处理播放结束事件
    if (playMode.value === 'loopOne') {
      // 单曲循环：重新播放当前歌曲
      if (audioPlayer.value) {
        audioPlayer.value.currentTime = 0
        // 使用 Promise 处理播放，避免自动播放策略问题
        const playPromise = audioPlayer.value.play()
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.error('单曲循环播放失败:', error)
            // 如果自动播放失败，更新播放状态
            isPlaying.value = false
          })
        }
      }
    } else if (playMode.value === 'order') {
      // 顺序播放：播放下一首
      // 如果没有下一首（列表结束），useAudioPlayer.playNext 会返回 false，此时自然停止
      const hasNext = globalAudioPlayer.hasNext.value
      if (hasNext) {
        globalAudioPlayer.playNext()
      } else {
        // 列表播放结束，停止播放
        isPlaying.value = false
        progress.value = 0
        currentTime.value = 0
      }
    } else {
      // 默认/播放完退出 (off)：停止播放
      isPlaying.value = false
      progress.value = 0
      currentTime.value = 0
    }
  }

  const onLoadStart = () => {
    hasError.value = false
  }

  const onCanPlay = () => {
    hasError.value = false
  }

  // 设置进度条引用
  const setProgressBarRef = (element: HTMLElement | null) => {
    progressBarRef.value = element
  }

  // 设置音频播放器引用
  const setAudioPlayerRef = (element: HTMLAudioElement | null) => {
    audioPlayer.value = element
    if (element) {
      element.volume = volume.value
    }
  }

  // 清理资源
  const cleanup = () => {
    loadGeneration++
    activeRequest?.cancel()
    activeRequest = null
    playbackIdentity = ''
    playbackOptions = {}
    playbackInfo.value = null
    if (audioPlayer.value) {
      // 先暂停播放
      audioPlayer.value.pause()

      // 不设置空的 src，避免触发 MEDIA_ERR_SRC_NOT_SUPPORTED 错误
      // 只是暂停播放即可，让组件自然销毁
    }
    resetState()
  }

  // 重置状态
  const resetState = () => {
    isPlaying.value = false
    progress.value = 0
    currentTime.value = 0
    duration.value = 0
    hasError.value = false
    coverError.value = false
    isDragging.value = false
    isSyncingFromGlobal.value = false
    isLoadingNewSong.value = false
    isLoadingTrack.value = false
  }

  // 强制更新位置（用于鸿蒙侧同步）
  const forceUpdatePosition = (timeInSeconds: number) => {
    // 如果正在拖拽，不要更新位置
    if (isDragging.value) {
      return false
    }

    if (!audioPlayer.value) {
      return false
    }

    try {
      // 设置同步标志，防止触发其他事件
      isSyncingFromGlobal.value = true

      // 如果有duration，使用它来限制范围；否则直接使用传入的时间
      const targetTime =
        duration.value > 0
          ? Math.max(0, Math.min(timeInSeconds, duration.value))
          : Math.max(0, timeInSeconds)

      // 更新音频播放器位置
      audioPlayer.value.currentTime = targetTime

      // 强制更新UI状态
      currentTime.value = targetTime

      // 只有在duration存在时才计算进度百分比
      if (duration.value > 0) {
        progress.value = (targetTime / duration.value) * 100
      }

      // 更新歌词时间
      const timeInMs = targetTime * 1000
      lyrics.updateCurrentLyricIndex(timeInMs)

      // 使用nextTick确保DOM更新
      nextTick(() => {
        isSyncingFromGlobal.value = false
      })

      return true
    } catch (error) {
      isSyncingFromGlobal.value = false
      return false
    }
  }

  // 设置播放模式
  const setPlayMode = (mode: 'off' | 'order' | 'loopOne') => {
    if (['off', 'order', 'loopOne'].includes(mode)) {
      playMode.value = mode
      return true
    }
    return false
  }

  // 音量控制
  const setVolume = (val: number) => {
    const newVolume = clampVolume(val)

    // 当用户手动调节非0音量时，记录为下一次取消静音的恢复值并持久化
    if (newVolume > 0) {
      preMuteVolume.value = newVolume
      persistVolume(newVolume)
    }
    
    volume.value = newVolume
    isMuted.value = newVolume === 0
    if (audioPlayer.value) {
      audioPlayer.value.volume = newVolume
    }
  }

  const toggleMute = () => {
    if (isMuted.value || volume.value === 0) {
      // 取消静音：如果用户手动把音量拉到 0 后又点击了恢复，此时记录的 preMuteVolume 会被用来恢复
      // 但如果连 preMuteVolume 记录的值都极小(如初始状态就是0)，那就默认恢复到 10%
      setVolume(preMuteVolume.value > 0.01 ? preMuteVolume.value : 0.1)
    } else {
      // 触发静音前，再更新一次历史音量
      preMuteVolume.value = volume.value
      setVolume(0)
    }
  }

  return {
    // 状态
    audioPlayer,
    isPlaying,
    progress,
    currentTime,
    duration,
    volume,
    isMuted,
    hasError,
    coverError,
    showQualitySettings,
    isDragging,
    isSyncingFromGlobal,
    isLoadingNewSong,
    isLoadingTrack,
    playbackInfo,
    lastLoadError,
    progressBarRef,
    hasUserInteracted,
    playMode, // 暴露播放模式

    // 基本控制
    play,
    setPlayMode, // 暴露设置播放模式方法
    pause,
    stop,
    seek,
    seekAndPlay, // 新增
    togglePlay,
    loadSong,
    getLoadGeneration: () => loadGeneration,
    getPlaybackOptions: () => ({ ...playbackOptions }),
    forceUpdatePosition,
    setVolume,
    toggleMute,

    // 音频事件处理
    onTimeUpdate,
    onLoaded,
    onError,
    onPlay,
    onPause,
    onEnded,
    onLoadStart,
    onCanPlay,
    setProgressBarRef,
    setAudioPlayerRef,

    // 音质控制
    switchQuality,
    currentQualityText,
    currentPlatformOptions,
    isCurrentQuality,

    // 拖拽控制
    startDrag,
    startTouchDrag,
    seekToPosition,

    // 工具函数
    formatTime,
    resetState,
    waitForCanPlay,
    cleanup,

    // 歌词功能
    lyrics
  }
}
