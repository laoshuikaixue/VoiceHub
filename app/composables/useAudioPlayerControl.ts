import { computed, nextTick, ref } from 'vue'
import { useAudioQuality } from '~/composables/useAudioQuality'
import { useLyrics } from '~/composables/useLyrics'
import { useAudioPlayer } from '~/composables/useAudioPlayer'

// 单例状态
const audioPlayer = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const progress = ref(0)
const currentTime = ref(0)
const duration = ref(0)
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
const progressBarRef = ref<HTMLElement | null>(null)
const hasUserInteracted = ref(false)

// 共享歌词实例
const lyrics = useLyrics()

export const useAudioPlayerControl = () => {
  // 音质 (Composable 使用应在 setup/function 内部)
  const { getQualityLabel, getQuality, getQualityOptions, saveQuality } = useAudioQuality()

  // 全局音频播放器
  const globalAudioPlayer = useAudioPlayer()

  // 基本播放控制
  const play = async (): Promise<boolean> => {
    // 等待音频播放器引用设置完成
    let retryCount = 0
    const maxRetries = 20

    while (!audioPlayer.value && retryCount < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      retryCount++
    }

    if (!audioPlayer.value || hasError.value) {
      return false
    }

    try {
      // 确保音频已经加载
      if (audioPlayer.value.readyState < 2) {
        await waitForCanPlay(audioPlayer.value)
      }

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
      // 检查是否是自动播放被阻止的错误
      if (error.name === 'NotAllowedError') {
        console.warn('[AudioPlayerControl] ⚠️ 自动播放被浏览器阻止，需要用户交互')
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
    if (!audioPlayer.value) return false

    try {
      audioPlayer.value.pause()
      audioPlayer.value.removeAttribute('src')
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

  // 等待音频可以播放
  const waitForCanPlay = (audio: HTMLAudioElement): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        audio.removeEventListener('canplay', onCanPlay)
        audio.removeEventListener('error', onError)
        reject(new Error('音频加载超时'))
      }, 10000) // 10秒超时

      const onCanPlay = () => {
        clearTimeout(timeout)
        audio.removeEventListener('canplay', onCanPlay)
        audio.removeEventListener('error', onError)
        resolve()
      }

      const onError = (error: Event) => {
        clearTimeout(timeout)
        audio.removeEventListener('canplay', onCanPlay)
        audio.removeEventListener('error', onError)
        reject(error)
      }

      audio.addEventListener('canplay', onCanPlay)
      audio.addEventListener('error', onError)
    })
  }

  // 加载新歌曲
  const loadSong = async (
    songUrlOrSong: string | any,
    retryCount: number = 0
  ): Promise<boolean> => {
    if (!audioPlayer.value) return false

    stop()
    isLoadingNewSong.value = true
    isLoadingTrack.value = true // 开始加载时设置加载状态
    hasError.value = false

    // 立即清空之前的歌词，避免显示上一首歌的歌词
    lyrics.clearLyrics()

    try {
      let songUrl: string
      let songInfo: any = null
      const lyricsPromise: Promise<void> | null = null

      // 如果传入的是歌曲对象，检查是否有音乐平台信息
      if (typeof songUrlOrSong === 'object' && songUrlOrSong !== null) {
        songInfo = songUrlOrSong

        // 优先检查是否已有直接的播放URL
        if (songUrlOrSong.musicUrl) {
          songUrl = songUrlOrSong.musicUrl

          // 清理URL中的反引号和空格（特别是网易云备用源）
          songUrl = songUrl.trim().replace(/`/g, '')
          console.log('使用已有的播放URL:', songUrl)

          // 如果有音乐平台信息，加载歌词
          if (songUrlOrSong.musicPlatform && songUrlOrSong.musicId) {
            // lyricsPromise = lyrics.fetchLyrics(songUrlOrSong.musicPlatform, songUrlOrSong.musicId)
            // 迁移到 useLyricManager 统一管理，避免重复请求
          }
        } else if (songUrlOrSong.musicPlatform && songUrlOrSong.musicId) {
          // 检查是否是网易云备用源，如果是则不应该调用getMusicUrl
          if (songUrlOrSong.sourceInfo?.source === 'netease-backup') {
            throw new Error('网易云备用源歌曲缺少播放URL，请重新获取')
          }

          console.log('正在获取歌曲URL:', songUrlOrSong.musicPlatform, songUrlOrSong.musicId)

          // 检查是否为播客内容
          const isPodcast =
            songUrlOrSong.musicPlatform === 'netease-podcast' ||
            songUrlOrSong.sourceInfo?.type === 'voice' ||
            (songUrlOrSong.sourceInfo?.source === 'netease-backup' &&
              songUrlOrSong.sourceInfo?.type === 'voice')
          const options = isPodcast ? { unblock: false } : {}

          songUrl = await getMusicUrl(
            songUrlOrSong.musicPlatform,
            songUrlOrSong.musicId,
            songUrlOrSong.playUrl,
            options
          )
          if (!songUrl) {
            throw new Error('无法获取歌曲URL')
          }

          // 并行加载歌词（不阻塞音频加载）
          // lyricsPromise = lyrics.fetchLyrics(songUrlOrSong.musicPlatform, songUrlOrSong.musicId)
          // 迁移到 useLyricManager 统一管理，避免重复请求
        } else {
          throw new Error('歌曲缺少播放信息（音乐平台ID或直接URL）')
        }
      } else if (typeof songUrlOrSong === 'string') {
        songUrl = songUrlOrSong
      } else {
        throw new Error('无效的歌曲参数')
      }

      console.log('设置音频源:', songUrl)
      audioPlayer.value.src = songUrl
      audioPlayer.value.load()

      // 等待音频可以播放
      await waitForCanPlay(audioPlayer.value)

      // 等待歌词加载完成（如果有的话）
      if (lyricsPromise) {
        try {
          await lyricsPromise
          // 歌词加载完成
        } catch (lyricsError) {
          console.warn('歌词加载失败，但继续播放音频:', lyricsError)
        }
      }

      console.log('歌曲加载成功:', songInfo?.title || songUrl)
      isLoadingNewSong.value = false

      // 自动开始播放
      console.log('尝试自动播放音乐')
      const playResult = await play()

      if (!playResult) {
        console.log('自动播放失败，可能被浏览器阻止，等待用户交互')
      } else {
        console.log('自动播放成功')
      }

      return true
    } catch (error) {
      console.error('加载歌曲失败:', error)

      // 重试逻辑
      if (retryCount < 2 && typeof songUrlOrSong === 'object' && songUrlOrSong?.musicPlatform) {
        console.log(`第 ${retryCount + 1} 次重试加载歌曲...`)
        await new Promise((resolve) => setTimeout(resolve, 1000)) // 等待1秒后重试
        return await loadSong(songUrlOrSong, retryCount + 1)
      }

      hasError.value = true
      isLoadingNewSong.value = false

      // 显示详细错误信息
      let errorMessage = '加载歌曲失败'
      if (error instanceof Error) {
        errorMessage = error.message
      }

      if (window.$showNotification) {
        window.$showNotification(errorMessage, 'error')
      }

      return false
    }
  }

  // 切换播放/暂停
  const togglePlay = async (): Promise<boolean> => {
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
      const newUrl = await getMusicUrl(
        platform,
        musicId,
        globalAudioPlayer.getCurrentSong().value?.playUrl
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
    }
  ): Promise<string | null> => {
    try {
      const { getMusicUrl: coreGetMusicUrl } = await import('~/utils/musicUrl')
      const url = await coreGetMusicUrl(platform, musicId, playUrl ?? undefined, options)
      return url
    } catch (error) {
      console.error('获取音乐URL错误:', error)
      if (error instanceof TypeError && (error as any).message?.includes('fetch')) {
        throw new Error('网络连接失败，请检查网络连接')
      } else if ((error as any).name === 'AbortError') {
        throw new Error('请求超时，请稍后重试')
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
  const onTimeUpdate = (currentTimeValue: number) => {
    if (isDragging.value) return

    currentTime.value = currentTimeValue
    if (duration.value > 0) {
      progress.value = (currentTimeValue / duration.value) * 100
    }

    // 更新歌词时间
    const timeInMs = currentTimeValue * 1000
    lyrics.updateCurrentLyricIndex(timeInMs) // 转换为毫秒
  }

  const onLoaded = (durationValue: number) => {
    duration.value = durationValue
    hasError.value = false
  }

  const onError = (error: any) => {
    console.error('音频播放错误:', error)

    // 获取更详细的错误信息
    let errorMessage = '音频播放失败'
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

    // 显示用户友好的错误提示
    if (window.$showNotification) {
      window.$showNotification(errorMessage, 'error')
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
    isPlaying.value = false
    progress.value = 0
    currentTime.value = 0
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
  }

  // 清理资源
  const cleanup = () => {
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

  return {
    // 状态
    audioPlayer,
    isPlaying,
    progress,
    currentTime,
    duration,
    hasError,
    coverError,
    showQualitySettings,
    isDragging,
    isSyncingFromGlobal,
    isLoadingNewSong,
    isLoadingTrack,
    progressBarRef,
    hasUserInteracted,

    // 基本控制
    play,
    pause,
    stop,
    seek,
    seekAndPlay, // 新增
    togglePlay,
    loadSong,
    forceUpdatePosition,

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
