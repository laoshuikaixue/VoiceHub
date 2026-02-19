import { onMounted, onUnmounted, readonly, ref } from 'vue'

interface MediaSessionSong {
  id: number
  title: string
  artist: string
  cover?: string | null
  musicUrl?: string | null
}

interface MediaSessionCallbacks {
  onPlay?: () => void
  onPause?: () => void
  onStop?: () => void
  onSeekBackward?: (details: MediaSessionActionDetails) => void
  onSeekForward?: (details: MediaSessionActionDetails) => void
  onSeekTo?: (details: MediaSessionActionDetails) => void
  onPreviousTrack?: () => void
  onNextTrack?: () => void
}

export const useMediaSession = () => {
  const isSupported = ref(false)
  const isActive = ref(false)
  const currentSong = ref<MediaSessionSong | null>(null)
  const callbacks = ref<MediaSessionCallbacks>({})

  // 检查浏览器是否支持 Media Session API
  const checkSupport = () => {
    isSupported.value = 'mediaSession' in navigator
    return isSupported.value
  }

  // 设置媒体元数据
  const setMetadata = (song: MediaSessionSong) => {
    if (!isSupported.value || !song) return

    currentSong.value = song

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || '未知歌曲',
        artist: song.artist || '未知艺术家',
        album: '', // 可以根据需要添加专辑信息
        artwork: song.cover
          ? [
              {
                src: song.cover,
                sizes: '96x96',
                type: 'image/png'
              },
              {
                src: song.cover,
                sizes: '128x128',
                type: 'image/png'
              },
              {
                src: song.cover,
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: song.cover,
                sizes: '256x256',
                type: 'image/png'
              },
              {
                src: song.cover,
                sizes: '384x384',
                type: 'image/png'
              },
              {
                src: song.cover,
                sizes: '512x512',
                type: 'image/png'
              }
            ]
          : []
      })
    } catch (error) {
      console.warn('设置媒体元数据失败:', error)
    }
  }

  // 设置播放状态
  const setPlaybackState = (state: MediaSessionPlaybackState) => {
    if (!isSupported.value) return

    try {
      navigator.mediaSession.playbackState = state
      isActive.value = state !== 'none'
    } catch (error) {
      console.warn('设置播放状态失败:', error)
    }
  }

  // 设置位置状态
  const setPositionState = (duration: number, playbackRate: number = 1, position: number = 0) => {
    if (!isSupported.value || !navigator.mediaSession.setPositionState) return

    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(0, duration),
        playbackRate: Math.max(0, playbackRate),
        position: Math.max(0, Math.min(position, duration))
      })
    } catch (error) {
      console.warn('设置位置状态失败:', error)
    }
  }

  // 设置动作处理器
  const setActionHandlers = (newCallbacks: MediaSessionCallbacks) => {
    if (!isSupported.value) return

    callbacks.value = { ...callbacks.value, ...newCallbacks }

    try {
      // 播放/暂停
      if (callbacks.value.onPlay) {
        navigator.mediaSession.setActionHandler('play', callbacks.value.onPlay)
      }
      if (callbacks.value.onPause) {
        navigator.mediaSession.setActionHandler('pause', callbacks.value.onPause)
      }
      if (callbacks.value.onStop) {
        navigator.mediaSession.setActionHandler('stop', callbacks.value.onStop)
      }

      // 跳转控制
      if (callbacks.value.onSeekBackward) {
        navigator.mediaSession.setActionHandler('seekbackward', callbacks.value.onSeekBackward)
      }
      if (callbacks.value.onSeekForward) {
        navigator.mediaSession.setActionHandler('seekforward', callbacks.value.onSeekForward)
      }
      if (callbacks.value.onSeekTo) {
        navigator.mediaSession.setActionHandler('seekto', callbacks.value.onSeekTo)
      }

      // 上一首/下一首
      if (callbacks.value.onPreviousTrack) {
        navigator.mediaSession.setActionHandler('previoustrack', callbacks.value.onPreviousTrack)
      }
      if (callbacks.value.onNextTrack) {
        navigator.mediaSession.setActionHandler('nexttrack', callbacks.value.onNextTrack)
      }
    } catch (error) {
      console.warn('设置动作处理器失败:', error)
    }
  }

  // 清除所有动作处理器
  const clearActionHandlers = () => {
    if (!isSupported.value) return

    try {
      const actions: MediaSessionAction[] = [
        'play',
        'pause',
        'stop',
        'seekbackward',
        'seekforward',
        'seekto',
        'previoustrack',
        'nexttrack'
      ]

      actions.forEach((action) => {
        navigator.mediaSession.setActionHandler(action, null)
      })
    } catch (error) {
      console.warn('清除动作处理器失败:', error)
    }
  }

  // 初始化 Media Session
  const initialize = (song?: MediaSessionSong, actionCallbacks?: MediaSessionCallbacks) => {
    if (!checkSupport()) {
      console.warn('当前浏览器不支持 Media Session API')
      return false
    }

    if (song) {
      setMetadata(song)
    }

    if (actionCallbacks) {
      setActionHandlers(actionCallbacks)
    }

    return true
  }

  // 清理 Media Session
  const cleanup = () => {
    if (!isSupported.value) return

    try {
      clearActionHandlers()
      navigator.mediaSession.metadata = null
      setPlaybackState('none')
      isActive.value = false
      currentSong.value = null
    } catch (error) {
      console.warn('清理 Media Session 失败:', error)
    }
  }

  // 更新歌曲信息
  const updateSong = (song: MediaSessionSong) => {
    if (!isSupported.value) return
    setMetadata(song)
  }

  // 更新播放状态
  const updatePlaybackState = (isPlaying: boolean) => {
    if (!isSupported.value) return
    setPlaybackState(isPlaying ? 'playing' : 'paused')
  }

  // 更新播放进度
  const updatePosition = (position: number, duration: number, playbackRate: number = 1) => {
    if (!isSupported.value) return
    setPositionState(duration, playbackRate, position)
  }

  // 组件挂载时检查支持
  onMounted(() => {
    checkSupport()
  })

  // 组件卸载时清理
  onUnmounted(() => {
    cleanup()
  })

  return {
    // 状态
    isSupported: readonly(isSupported),
    isActive: readonly(isActive),
    currentSong: readonly(currentSong),

    // 方法
    initialize,
    cleanup,
    updateSong,
    updatePlaybackState,
    updatePosition,
    setActionHandlers,
    clearActionHandlers,

    // 底层方法（高级用法）
    setMetadata,
    setPlaybackState,
    setPositionState
  }
}
