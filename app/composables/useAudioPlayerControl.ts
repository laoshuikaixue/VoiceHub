import { computed, nextTick, ref } from 'vue'
import { useAudioQuality } from '~/composables/useAudioQuality'
import { useLyrics } from '~/composables/useLyrics'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useLocale } from '~/utils/locale'
import type { MusicTrackMeta } from '~/utils/musicUrl'

/**
 * 音量持久化：仅记录最后一次非 0 音量，静音属于瞬时状态不落盘，
 * 避免刷新后出现「看起来在播但没声音」
 */
const VOLUME_STORAGE_KEY = 'voicehub_player_volume'

const clampVolume = (value: number): number => Math.max(0, Math.min(1, value))

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

// 播放/暂停淡入淡出时长
const FADE_IN_MS = 180
const FADE_OUT_MS = 150
// requestAnimationFrame 在后台标签页会被节流，用定时兜底保证包络一定落到目标值
const FADE_GUARD_MS = 120

// 淡入淡出只改这个包络，元素音量恒为 volume * fadeEnvelope
let fadeEnvelope = 1
let fadeSeq = 0

const applyElementVolume = () => {
  if (!audioPlayer.value) return
  audioPlayer.value.volume = clampVolume(volume.value * fadeEnvelope)
}

// 作废淡变并把包络归位，用于换源、重建元素等必须回到正常音量的路径
const cancelFade = () => {
  fadeSeq++
  fadeEnvelope = 1
  applyElementVolume()
}

const startFade = (target: number, durationMs: number, onFinish?: () => void) => {
  const seq = ++fadeSeq
  const from = fadeEnvelope
  let settled = false

  const finish = () => {
    if (settled || seq !== fadeSeq) return
    settled = true
    fadeEnvelope = target
    applyElementVolume()
    onFinish?.()
  }

  if (!import.meta.client || durationMs <= 0 || from === target) {
    finish()
    return
  }

  const startTime = performance.now()
  const step = (now: number) => {
    if (seq !== fadeSeq) return
    const ratio = Math.min(1, (now - startTime) / durationMs)
    fadeEnvelope = from + (target - from) * ratio
    applyElementVolume()
    if (ratio >= 1) {
      finish()
      return
    }
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
  setTimeout(finish, durationMs + FADE_GUARD_MS)
}

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

// 播放模式: 'off' (单曲播放完退出) | 'order' (顺序播放列表) | 'loopOne' (单曲循环)
const playMode = ref<'off' | 'order' | 'loopOne'>('order')

// 共享歌词实例
const lyrics = useLyrics()

export const useAudioPlayerControl = () => {
  const { audioPlayer: audioPlayerLocale } = useLocale()
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

    const element = audioPlayer.value
    // 结束进行中的淡变并归位音量：既作废上一次淡出遗留的暂停回调，
    // 也避免重复 play() 把淡入卡在中间值造成持续偏静
    cancelFade()
    const wasPlaying = !element.paused

    try {
      // 确保音频已经加载
      if (element.readyState < 2) {
        await waitForCanPlay(element)
      }

      // 设置音频属性以支持自动播放
      element.autoplay = true
      element.preload = 'auto'

      if (!wasPlaying) {
        // 起播前先把音量压到 0，避免 play() 生效瞬间的硬启爆音
        fadeEnvelope = 0
        applyElementVolume()
      }

      const playPromise = element.play()

      // 处理播放 Promise
      if (playPromise !== undefined) {
        await playPromise
      }

      if (!wasPlaying) {
        startFade(1, FADE_IN_MS)
      } else {
        // 淡出没走完就恢复播放时元素一直在播，play 事件不会重复触发，需自行修正状态
        isPlaying.value = true
      }
      return true
    } catch (error) {
      cancelFade()
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

    if (audioPlayer.value.paused) {
      cancelFade()
      return true
    }

    try {
      // 淡出仍需 150ms 才真正暂停，界面先进入暂停态，避免按钮停在播放态
      isPlaying.value = false
      startFade(0, FADE_OUT_MS, () => {
        try {
          audioPlayer.value?.pause()
        } catch (error) {
          console.error('暂停失败:', error)
        }
        // 淡出结束即归位包络，保证下次起播从正常音量开始
        cancelFade()
      })
      return true
    } catch (error) {
      cancelFade()
      console.error('暂停失败:', error)
      return false
    }
  }

  const stop = (): boolean => {
    if (!audioPlayer.value) return false

    try {
      cancelFade()
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
        
        if (!audio.src || audio.src === window.location.href || audio.src === window.location.origin + '/') {
          reject(new Error('AbortError'))
        } else {
          reject(error)
        }
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
          const options: { unblock?: boolean; musicInfo?: MusicTrackMeta } = isPodcast
            ? { unblock: false }
            : {}
          options.musicInfo = {
            name: songUrlOrSong.title,
            artist: songUrlOrSong.artist,
            album: songUrlOrSong.album || undefined
          }

          songUrl = await getMusicUrl(
            songUrlOrSong.musicPlatform,
            songUrlOrSong.musicId,
            songUrlOrSong.playUrl,
            { ...options, musicInfo: { ...(options?.musicInfo || {}), rawItem: songUrlOrSong } }
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
    } catch (error: any) {
      if (error?.message === 'AbortError') {
        console.log('音频加载被主动中止')
        return false
      }

      // 重试逻辑（针对网络抖动等临时错误）
      if (
        retryCount < 2 &&
        !hasError.value &&
        typeof songUrlOrSong === 'object' &&
        songUrlOrSong?.musicPlatform
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        if (hasError.value) return false
        return await loadSong(songUrlOrSong, retryCount + 1)
      }

      hasError.value = true
      isLoadingNewSong.value = false
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
    // 曲目已自然结束，遗留的淡出回调不应再去暂停下一段播放
    cancelFade()
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
      // 换平台会因 :key 重建元素，新元素必须从正常音量开始
      cancelFade()
    }
  }

  // 清理资源
  const cleanup = () => {
    if (audioPlayer.value) {
      // 先暂停播放
      cancelFade()
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
    applyElementVolume()
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
