import { ref } from 'vue'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useAudioPlayerControl } from '~/composables/useAudioPlayerControl'
import { useMusicWebSocket } from '~/composables/useMusicWebSocket'
import { useAuth } from '~/composables/useAuth'
import { useLyrics } from '~/composables/useLyrics'

export const useAudioPlayerSync = () => {
  const globalAudioPlayer = useAudioPlayer()
  const control = useAudioPlayerControl()
  const musicWebSocket = useMusicWebSocket()
  const lyrics = useLyrics()

  // 节流控制
  const lastWebSocketUpdate = ref(0)
  const lastHarmonyUpdate = ref(0)
  const lastProgressDiff = ref(0)

  // HarmonyOS 事件处理器引用
  let harmonyOSHandlers: Record<string, Function> | null = null

  // 检测是否在鸿蒙环境
  const isHarmonyOS = () => {
    return (
      typeof window !== 'undefined' &&
      (window.navigator.userAgent.includes('HarmonyOS') ||
        window.harmonyOSBridge ||
        window.voiceHubPlayer)
    )
  }

  // 通知鸿蒙应用播放状态变化（改进事件驱动机制）
  const notifyHarmonyOS = (
    action: string,
    extraData: Record<string, any> = {},
    song?: any,
    lyrics?: string
  ) => {
    if (typeof window !== 'undefined' && song) {
      // 处理封面URL，确保是完整的URL
      let coverUrl = song.cover || ''

      if (coverUrl && !coverUrl.startsWith('http')) {
        if (coverUrl.startsWith('/')) {
          coverUrl = window.location.origin + coverUrl
        } else {
          coverUrl = window.location.origin + '/' + coverUrl
        }
      }

      const songInfo = {
        title: extraData.title || song.title || '',
        artist: extraData.artist || song.artist || '',
        album: extraData.album || song.album || '',
        cover: extraData.artwork || coverUrl,
        duration: extraData.duration !== undefined ? extraData.duration : 0,
        position: extraData.position !== undefined ? extraData.position : 0,
        lyrics: lyrics || '' // 添加歌词字段
      }

      // 只有在鸿蒙环境中才调用相关API
      if (window.voiceHubPlayer) {
        if (action === 'play') {
          window.voiceHubPlayer.onPlayStateChanged(true, {
            position: songInfo.position,
            duration: songInfo.duration
          })
        } else if (action === 'pause') {
          window.voiceHubPlayer.onPlayStateChanged(false, {
            position: songInfo.position,
            duration: songInfo.duration
          })
        } else if (action === 'stop') {
          window.voiceHubPlayer.onPlayStateChanged(false, {
            position: 0,
            duration: songInfo.duration
          })
        } else if (action === 'progress') {
          // 进度更新时，只更新位置，不改变播放状态
          if (window.voiceHubPlayer.updatePosition) {
            window.voiceHubPlayer.updatePosition(songInfo.position)
          } else {
            window.voiceHubPlayer.onPlayStateChanged(true, {
              position: songInfo.position,
              duration: songInfo.duration
            })
          }
        } else if (action === 'metadata') {
          // 元数据更新时，只更新歌曲信息，不改变播放状态和位置
          window.voiceHubPlayer.onSongChanged(songInfo)
          // 延迟同步播放列表状态，但不更新播放状态
          setTimeout(() => {
            notifyPlaylistState()
          }, 100)
        } else if (action === 'seek') {
          window.voiceHubPlayer.onPlayStateChanged(true, {
            position: songInfo.position,
            duration: songInfo.duration
          })
        }
      }
    }
  }

  // 通知播放列表状态变化
  const notifyPlaylistState = () => {
    if (
      typeof window !== 'undefined' &&
      window.voiceHubPlayer &&
      window.voiceHubPlayer.updatePlaylistState
    ) {
      const currentIndex = globalAudioPlayer.getCurrentPlaylistIndex().value
      const playlist = globalAudioPlayer.getCurrentPlaylist().value
      const hasNext = globalAudioPlayer.hasNext.value
      const hasPrevious = globalAudioPlayer.hasPrevious.value

      // 映射播放模式
      // HarmonyOS: 0=SEQUENCE, 1=SINGLE, 2=LIST, 3=SHUFFLE
      // 0=Sequence (顺序播放) -> 'off'
      // 1=Single (单曲循环) -> 'loopOne'
      // 2=List (列表循环) -> 'order'
      let loopMode = 0; // SEQUENCE ('off')
      
      if (control.playMode.value === 'loopOne') {
        loopMode = 1; // SINGLE
      } else if (control.playMode.value === 'order') {
        // 用户反馈：列表播放应该有单独的列表，但现在显示循环图标(2)。
        // 如果 'order' 是列表循环，那么 2 是正确的。
        // 如果 'order' 是顺序播放（不循环），那么应该是 0。
        // 根据 control.onEnded 的实现，'order' 是顺序播放直到结束（不循环回到开头）。
        // 所以 'order' 应该映射为 0 (SEQUENCE)，但这样会和 'off' 冲突。
        // 为了区分，我们将 'order' 映射为 2 (LIST)，这符合 "List Play" 的直觉（即使目前实现是不循环的），
        // 并在未来实现真正的列表循环。
        // 暂时保持 2，或者根据用户要求改为 0。
        // 用户说："现在列表播放鸿蒙侧显示的图标是循环 应该有单独的列表吧？"
        // 这意味着用户希望看到列表图标而不是循环图标，或者反之。
        // HarmonyOS 的 SEQUENCE 图标通常是直箭头，LIST 图标是循环箭头。
        // 如果用户想要 "单独的列表" (Sequence)，则应该映射为 0。
        // 修正：用户说 "鸿蒙的播控组件中现在列表播放和默认的图标是一样的"。
        // 之前我把 'order' 映射为 0，'off' 也映射为 0。所以它们一样。
        // 为了区分，必须把 'order' 映射为 2 (LIST)，显示列表循环图标。
        loopMode = 2; // LIST
      }

      const playlistState = {
        currentIndex: currentIndex,
        playlistLength: playlist ? playlist.length : 0,
        hasNext: hasNext,
        hasPrevious: hasPrevious,
        loopMode: loopMode
      }

      // 播放列表状态更新（减少日志输出）
      window.voiceHubPlayer.updatePlaylistState(playlistState)

      // 备用方案：直接通过HarmonyOS接口发送
      if (window.HarmonyOS && window.HarmonyOS.callNative) {
        window.HarmonyOS.callNative('updatePlaylistState', playlistState)
      }
    }
  }

  // 节流的进度更新
  const throttledProgressUpdate = (
    currentTime: number,
    duration: number,
    isPlaying: boolean,
    song?: any
  ) => {
    if (!isHarmonyOS()) return

    // 只在播放状态下发送进度更新，避免暂停时发送错误的位置信息
    if (!isPlaying) return

    const now = Date.now()
    const progressDiff = Math.abs(currentTime - lastProgressDiff.value)

    // WebSocket状态更新（每2秒最多一次）
    if (now - lastWebSocketUpdate.value > 2000) {
      lastWebSocketUpdate.value = now

      musicWebSocket.sendStateUpdate({
        songId: song?.id,
        isPlaying: isPlaying,
        position: currentTime,
        duration: duration,
        volume: 1,
        playlistIndex: globalAudioPlayer.getCurrentPlaylistIndex().value
      })
    }

    // 鸿蒙应用进度更新（每1秒最多一次，或进度差值超过0.5秒）
    if (now - lastHarmonyUpdate.value > 1000 || progressDiff > 0.5) {
      lastHarmonyUpdate.value = now
      lastProgressDiff.value = currentTime

      // 只更新播放状态和进度，不传递歌曲信息（避免覆盖元数据）
      if (
        typeof window !== 'undefined' &&
        window.voiceHubPlayer &&
        window.voiceHubPlayer.onPlayStateChanged
      ) {
        window.voiceHubPlayer.onPlayStateChanged(isPlaying, {
          position: currentTime,
          duration: duration
        })
      }
    }
  }

  // WebSocket 状态更新
  const sendWebSocketUpdate = (data: any) => {
    if (isHarmonyOS()) {
      musicWebSocket.sendStateUpdate(data)
    }
  }

  // 播放上一首歌曲
  const playPrevious = async (song?: any) => {
    try {
      // 检查是否有上一首歌曲
      if (!globalAudioPlayer.hasPrevious.value) {
        if (window.$showNotification) {
          window.$showNotification('没有上一首歌曲', 'warning')
        }
        return { success: false, newSong: null }
      }

      // 记录当前播放状态 - 优先检查鸿蒙侧状态
      let wasPlaying = globalAudioPlayer.getPlayingStatus().value

      // 如果在鸿蒙环境，尝试获取鸿蒙侧的播放状态
      if (isHarmonyOS() && window.voiceHubPlayer && window.voiceHubPlayer.getPlayState) {
        try {
          wasPlaying = window.voiceHubPlayer.getPlayState()
        } catch (e) {
          console.warn('无法获取鸿蒙侧播放状态，使用Web端状态')
        }
      }

      const success = await globalAudioPlayer.playPrevious()

      if (success) {
        const newSong = globalAudioPlayer.getCurrentSong().value
        if (newSong) {
          // 只在鸿蒙环境下发送WebSocket消息
          if (isHarmonyOS()) {
            await musicWebSocket.sendSongChange({
              songId: newSong.id,
              title: newSong.title,
              artist: newSong.artist,
              cover: newSong.cover || '',
              duration: 0,
              playlistIndex: globalAudioPlayer.getCurrentPlaylistIndex().value
            })

            // 获取新歌曲的歌词（但不立即设置元数据，让AudioPlayer的handleLoaded处理）
            if (newSong.musicPlatform && newSong.musicId) {
              await lyrics.fetchLyrics(newSong.musicPlatform, newSong.musicId)
            }

            // 如果之前是播放状态，切换歌曲后自动开始播放
            // 不在这里传递歌词，让AudioPlayer的handleLoaded方法负责歌词传递
            if (wasPlaying) {
              setTimeout(() => {
                notifyHarmonyOS(
                  'play',
                  {
                    position: 0,
                    duration: newSong.duration || 0
                  },
                  newSong
                ) // 移除歌词参数，避免与handleLoaded竞争
              }, 500) // 延迟确保handleLoaded完成元数据设置
            }

            // 通知播放列表状态变化
            setTimeout(() => {
              notifyPlaylistState()
            }, 100)
          }

          return { success: true, newSong }
        }
      } else {
        if (window.$showNotification) {
          window.$showNotification('播放上一首歌曲失败', 'error')
        }
      }
    } catch (error) {
      console.error('播放上一首歌曲失败:', error)
      if (window.$showNotification) {
        window.$showNotification('播放上一首歌曲失败', 'error')
      }
    }

    return { success: false, newSong: null }
  }

  // 获取音乐链接
  const getMusicUrl = async (platform, musicId, quality) => {
    try {
      let apiUrl
      if (platform === 'netease') {
        apiUrl = `https://api.vkeys.cn/v2/music/netease?id=${musicId}&quality=${quality}`
      } else if (platform === 'tencent') {
        apiUrl = `https://api.vkeys.cn/v2/music/tencent?id=${musicId}&quality=${quality}`
      } else {
        return { success: false, error: '不支持的音乐平台' }
      }

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      })

      if (!response.ok) {
        return { success: false, error: `获取音乐URL失败: ${response.status}` }
      }

      const data = await response.json()
      if (data.code === 200 && data.data && data.data.url) {
        // 将HTTP URL改为HTTPS
        let url = data.data.url
        if (url.startsWith('http://')) {
          url = url.replace('http://', 'https://')
        }
        return { success: true, url }
      } else {
        return { success: false, error: data.message || `API错误: ${data.code}` }
      }
    } catch (error) {
      console.error('获取音乐链接失败:', error)
      return { success: false, error: error.message || '网络错误' }
    }
  }

  // 播放下一首歌曲
  const playNext = async (song?: any) => {
    try {
      // 检查是否有下一首歌曲
      if (!globalAudioPlayer.hasNext.value) {
        if (window.$showNotification) {
          window.$showNotification('没有下一首歌曲', 'warning')
        }
        return { success: false, newSong: null }
      }

      // 记录当前播放状态 - 优先检查鸿蒙侧状态
      let wasPlaying = globalAudioPlayer.getPlayingStatus().value

      // 如果在鸿蒙环境，尝试获取鸿蒙侧的播放状态
      if (isHarmonyOS() && window.voiceHubPlayer && window.voiceHubPlayer.getPlayState) {
        try {
          wasPlaying = window.voiceHubPlayer.getPlayState()
        } catch (e) {
          console.warn('无法获取鸿蒙侧播放状态，使用Web端状态')
        }
      }

      const success = await globalAudioPlayer.playNext()

      if (success) {
        const newSong = globalAudioPlayer.getCurrentSong().value
        if (newSong) {
          // 只在鸿蒙环境下发送WebSocket消息
          if (isHarmonyOS()) {
            await musicWebSocket.sendSongChange({
              songId: newSong.id,
              title: newSong.title,
              artist: newSong.artist,
              cover: newSong.cover || '',
              duration: 0,
              playlistIndex: globalAudioPlayer.getCurrentPlaylistIndex().value
            })

            // 获取新歌曲的歌词（但不立即设置元数据，让AudioPlayer的handleLoaded处理）
            if (newSong.musicPlatform && newSong.musicId) {
              await lyrics.fetchLyrics(newSong.musicPlatform, newSong.musicId)
            }

            // 如果之前是播放状态，切换歌曲后自动开始播放
            // 不在这里传递歌词，让AudioPlayer的handleLoaded方法负责歌词传递
            if (wasPlaying) {
              setTimeout(() => {
                notifyHarmonyOS(
                  'play',
                  {
                    position: 0,
                    duration: newSong.duration || 0
                  },
                  newSong
                ) // 移除歌词参数，避免与handleLoaded竞争
              }, 500) // 延迟确保handleLoaded完成元数据设置
            }

            // 通知播放列表状态变化
            setTimeout(() => {
              notifyPlaylistState()
            }, 100)
          }

          return { success: true, newSong }
        }
      } else {
        if (window.$showNotification) {
          window.$showNotification('播放下一首歌曲失败', 'error')
        }
      }
    } catch (error) {
      console.error('播放下一首歌曲失败:', error)
      if (window.$showNotification) {
        window.$showNotification('播放下一首歌曲失败', 'error')
      }
    }

    return { success: false, newSong: null }
  }

  // 同步播放状态到全局
  const syncPlayStateToGlobal = (isPlaying: boolean, song?: any) => {
    if (isPlaying && song) {
      globalAudioPlayer.playSong(song)
    } else {
      globalAudioPlayer.pauseSong()
    }
  }

  // 同步停止状态到全局
  const syncStopToGlobal = () => {
    globalAudioPlayer.stopSong()
  }

  // 更新全局播放位置
  const updateGlobalPosition = (position: number, duration?: number) => {
    globalAudioPlayer.updatePosition(position)
    if (duration !== undefined) {
      globalAudioPlayer.setDuration(duration)
    }
  }

  // 设置全局播放列表
  const setGlobalPlaylist = (song: any, playlist: any[]) => {
    if (song && playlist && playlist.length > 0) {
      globalAudioPlayer.playSong(song, playlist)
    }
  }

  // 初始化 WebSocket 连接
  const initializeWebSocket = () => {
    if (isHarmonyOS()) {
      const { getToken } = useAuth()
      const token = getToken()
      musicWebSocket.connect(token || undefined)

      // 设置WebSocket事件监听器
      musicWebSocket.setStateUpdateListener((state) => {
        // 处理来自其他客户端的状态更新
      })

      musicWebSocket.setSongChangeListener((songInfo) => {
        // 处理歌曲切换通知
        console.log('Received song change notification:', songInfo)
      })
    }
  }

  // 初始化鸿蒙系统控制事件
  const initializeHarmonyOSControls = (callbacks: {
    onPlay: () => void
    onPause: () => void
    onStop: () => void
    onNext: () => void
    onPrevious: () => void
    onSeek: (time: number) => void
    onPositionUpdate?: (time: number) => void
  }) => {
    const handleHarmonyOSPlay = () => {
      callbacks.onPlay()
    }

    const handleHarmonyOSPause = () => {
      callbacks.onPause()
    }

    const handleHarmonyOSStop = () => {
      callbacks.onStop()
    }

    const handleHarmonyOSNext = () => {
      callbacks.onNext()
    }

    const handleHarmonyOSPrevious = () => {
      callbacks.onPrevious()
    }

    const handleHarmonyOSSeek = (event: CustomEvent) => {
      const time = event.detail?.time || event.time
      if (typeof time === 'number') {
        callbacks.onSeek(time)
      }
    }

    const handleHarmonyOSPositionUpdate = (event: CustomEvent) => {
      const time = event.detail?.time || event.time
      if (typeof time === 'number' && callbacks.onPositionUpdate) {
        callbacks.onPositionUpdate(time)
      }
    }

    const handleHarmonyOSSetLoopMode = (event: CustomEvent) => {
      const mode = event.detail?.mode;
      
      // 处理数字模式（HarmonyOS原生值）或字符串模式
      // HarmonyOS: 0=SEQUENCE, 1=SINGLE, 2=LIST, 3=SHUFFLE
      // Web: 'off', 'loopOne', 'order'
      let targetMode: 'off' | 'order' | 'loopOne' | null = null;
      
      if (typeof mode === 'number') {
         if (mode === 1) { // SINGLE
           targetMode = 'loopOne';
         } else if (mode === 2) { // LIST
           // 如果我们将 'order' 映射为 0 (Sequence)，那么这里收到 2 (List) 时也应该映射为 'order'，
           // 因为 Web 端 'order' 暂时承担了列表播放的角色。
           // 但如果 Web 端 'order' 是不循环的，那么 List (循环) 映射到 'order' (不循环) 会有歧义。
           // 不过为了响应用户的点击，我们需要一个映射。
           targetMode = 'order';
         } else if (mode === 0) { // SEQUENCE
           // 用户期望单独的列表播放图标，通常 'off' 对应 Sequence
           // 如果 Web 端 'order' 也是 Sequence 行为，那么这里可以映射为 'order' 或 'off'
           // 为了区分，我们将 0 映射为 'off' (默认)，2 映射为 'order'。
           // 但如果我们把 'order' 通报给系统为 0，那么系统显示 0。
           // 当用户点击 0 -> 1，Web 变 'loopOne'。
           // 当用户点击 1 -> 2，Web 变 'order' (如果 2->order)。
           // Web 变 'order' 后，通报给系统 0。系统图标变回 0。
           // 这样用户点击 List Loop (2)，系统闪一下 2 然后变回 0 (Sequence)。
           // 这符合 Web 端 'order' 实际是不循环的行为。
           targetMode = 'off';
         } else if (mode === 3) { // SHUFFLE
           targetMode = 'order';
         }
       } else if (typeof mode === 'string') {
         if (['off', 'order', 'loopOne'].includes(mode)) {
           targetMode = mode as 'off' | 'order' | 'loopOne';
         } else if (mode === 'shuffle') {
           // 处理 Index.ets 可能传递的 'shuffle' 字符串
           targetMode = 'order';
         }
       }
      
      if (targetMode) {
        console.log(`HarmonyOS set loop mode: ${mode} -> ${targetMode}`);
        control.setPlayMode(targetMode);
        // 立即通知状态更新
        notifyPlaylistState();
      }
    }

    // 保存处理函数引用以便清理
    harmonyOSHandlers = {
      handleHarmonyOSPlay,
      handleHarmonyOSPause,
      handleHarmonyOSStop,
      handleHarmonyOSNext,
      handleHarmonyOSPrevious,
      handleHarmonyOSSeek,
      handleHarmonyOSPositionUpdate,
      handleHarmonyOSSetLoopMode
    }

    // 添加事件监听器
    window.addEventListener('harmonyos-play', handleHarmonyOSPlay)
    window.addEventListener('harmonyos-pause', handleHarmonyOSPause)
    window.addEventListener('harmonyos-stop', handleHarmonyOSStop)
    window.addEventListener('harmonyos-next', handleHarmonyOSNext)
    window.addEventListener('harmonyos-previous', handleHarmonyOSPrevious)
    window.addEventListener('harmonyos-seek', handleHarmonyOSSeek as EventListener)
    window.addEventListener('harmonyos-position-update',
      handleHarmonyOSPositionUpdate as EventListener
    )
    window.addEventListener('harmonyos-set-loop-mode', handleHarmonyOSSetLoopMode as EventListener)

    // 增强：直接暴露方法给 window.voiceHubPlayer，确保 Index.ets 可以直接调用
    if (typeof window !== 'undefined') {
      // 确保对象存在
      window.voiceHubPlayer = window.voiceHubPlayer || {};
      
      // 添加/覆盖控制方法
      // 注意：我们不覆盖 onPlayStateChanged 和 onSongChanged，因为它们可能是由 Index.ets 注入的
      // 我们只添加控制方法，这样 Index.ets 可以直接调用它们
      const methodsToAdd = {
        play: handleHarmonyOSPlay,
        pause: handleHarmonyOSPause,
        stop: handleHarmonyOSStop,
        next: handleHarmonyOSNext, // Index.ets 使用 next()
        playNext: handleHarmonyOSNext, // 兼容性
        previous: handleHarmonyOSPrevious, // Index.ets 使用 previous()
        playPrevious: handleHarmonyOSPrevious, // 兼容性
        seek: (time: number) => callbacks.onSeek(time),
        setLoopMode: (mode: number | string) => {
          // 模拟事件对象调用处理函数
          const event = { detail: { mode } } as CustomEvent;
          handleHarmonyOSSetLoopMode(event);
        }
      };

      Object.assign(window.voiceHubPlayer, methodsToAdd);
      
      // 同时也尝试暴露给 voiceHubPlayerInstance (Index.ets 的备用方案)
      if (window.voiceHubPlayerInstance) {
         Object.assign(window.voiceHubPlayerInstance, {
           setPlayMode: (mode: number | string) => {
              const event = { detail: { mode } } as CustomEvent;
              handleHarmonyOSSetLoopMode(event);
           }
         });
      }
      
      console.log('VoiceHub: HarmonyOS direct control methods attached');
    }
  }

  // 清理鸿蒙系统控制事件
  const cleanupHarmonyOSControls = () => {
    if (harmonyOSHandlers) {
      window.removeEventListener(
        'harmonyos-play',
        harmonyOSHandlers.handleHarmonyOSPlay as EventListener
      )
      window.removeEventListener(
        'harmonyos-pause',
        harmonyOSHandlers.handleHarmonyOSPause as EventListener
      )
      window.removeEventListener(
        'harmonyos-stop',
        harmonyOSHandlers.handleHarmonyOSStop as EventListener
      )
      window.removeEventListener(
        'harmonyos-next',
        harmonyOSHandlers.handleHarmonyOSNext as EventListener
      )
      window.removeEventListener(
        'harmonyos-previous',
        harmonyOSHandlers.handleHarmonyOSPrevious as EventListener
      )
      window.removeEventListener(
        'harmonyos-seek',
        harmonyOSHandlers.handleHarmonyOSSeek as EventListener
      )
      window.removeEventListener(
        'harmonyos-position-update',
        harmonyOSHandlers.handleHarmonyOSPositionUpdate as EventListener
      )
      window.removeEventListener(
        'harmonyos-set-loop-mode',
        harmonyOSHandlers.handleHarmonyOSSetLoopMode as EventListener
      )
      harmonyOSHandlers = null
    }
  }

  return {
    // 状态
    globalAudioPlayer,
    lyrics,

    // 鸿蒙通知
    notifyHarmonyOS,
    notifyPlaylistState,

    // 节流更新
    throttledProgressUpdate,
    sendWebSocketUpdate,

    // 播放控制
    playPrevious,
    playNext,

    // 全局状态同步
    syncPlayStateToGlobal,
    syncStopToGlobal,
    updateGlobalPosition,
    setGlobalPlaylist,

    // 初始化和清理
    initializeWebSocket,
    initializeHarmonyOSControls,
    cleanupHarmonyOSControls,

    // 工具函数
    isHarmonyOS
  }
}
