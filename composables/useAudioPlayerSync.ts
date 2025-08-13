import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useMusicWebSocket } from '~/composables/useMusicWebSocket'
import { useAuth } from '~/composables/useAuth'
import { useLyrics } from '~/composables/useLyrics'
import { useAudioQuality } from '~/composables/useAudioQuality'

export const useAudioPlayerSync = () => {
  const globalAudioPlayer = useAudioPlayer()
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
    return typeof window !== 'undefined' && 
           (window.navigator.userAgent.includes('HarmonyOS') || 
            window.harmonyOSBridge || 
            window.voiceHubPlayer)
  }

  // 通知鸿蒙应用播放状态变化（改进事件驱动机制）
  const notifyHarmonyOS = (action: string, extraData: Record<string, any> = {}, song?: any, lyrics?: string) => {
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

      // 添加调试信息
      if (action === 'metadata') {
        console.log(`[HarmonyOS] 调试信息:`)
        console.log(`  extraData:`, extraData)
        console.log(`  song:`, song)
        console.log(`  构建的songInfo:`, songInfo)
      }

      // 只记录重要的状态变化
      if (action === 'metadata' || action === 'stop') {
        console.log(`[HarmonyOS] ${action}:`, songInfo.title)
        // 添加歌词传递调试信息
        if (action === 'metadata') {
          // 传递歌词给鸿蒙侧
        }
      }

      // 只有在鸿蒙环境中才调用相关API
      if (window.voiceHubPlayer) {
        if (action === 'play') {
          console.log(`[HarmonyOS] 🎵 通知播放状态: 播放 - ${songInfo.title}, 位置=${songInfo.position}s, 时长=${songInfo.duration}s`)
          window.voiceHubPlayer.onPlayStateChanged(true, {
            position: songInfo.position,
            duration: songInfo.duration
          })
        } else if (action === 'pause') {
          console.log(`[HarmonyOS] ⏸️ 通知播放状态: 暂停 - ${songInfo.title}, 位置=${songInfo.position}s, 时长=${songInfo.duration}s`)
          window.voiceHubPlayer.onPlayStateChanged(false, {
            position: songInfo.position,
            duration: songInfo.duration
          })
        } else if (action === 'stop') {
          console.log(`[HarmonyOS] ⏹️ 通知播放状态: 停止 - ${songInfo.title}`)
          window.voiceHubPlayer.onPlayStateChanged(false, { position: 0, duration: songInfo.duration })
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
    if (typeof window !== 'undefined' && window.voiceHubPlayer && window.voiceHubPlayer.updatePlaylistState) {
      const currentIndex = globalAudioPlayer.getCurrentPlaylistIndex().value
      const playlist = globalAudioPlayer.getCurrentPlaylist().value
      const hasNext = globalAudioPlayer.hasNext.value
      const hasPrevious = globalAudioPlayer.hasPrevious.value
      
      const playlistState = {
        currentIndex: currentIndex,
        playlistLength: playlist ? playlist.length : 0,
        hasNext: hasNext,
        hasPrevious: hasPrevious
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
  const throttledProgressUpdate = (currentTime: number, duration: number, isPlaying: boolean, song?: any) => {
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
      if (typeof window !== 'undefined' && window.voiceHubPlayer && window.voiceHubPlayer.onPlayStateChanged) {
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
                notifyHarmonyOS('play', {
                  position: 0,
                  duration: newSong.duration || 0
                }, newSong) // 移除歌词参数，避免与handleLoaded竞争
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
                notifyHarmonyOS('play', {
                  position: 0,
                  duration: newSong.duration || 0
                }, newSong) // 移除歌词参数，避免与handleLoaded竞争
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
  }) => {
    if (!isHarmonyOS()) return

    const handleHarmonyOSPlay = () => {
      console.log('[HarmonyOS] 收到播放命令')
      callbacks.onPlay()
    }

    const handleHarmonyOSPause = () => {
      console.log('[HarmonyOS] 收到暂停命令')
      callbacks.onPause()
    }

    const handleHarmonyOSStop = () => {
      console.log('[HarmonyOS] 收到停止命令')
      callbacks.onStop()
    }

    const handleHarmonyOSNext = () => {
      console.log('[HarmonyOS] 收到下一首命令')
      callbacks.onNext()
    }

    const handleHarmonyOSPrevious = () => {
      console.log('[HarmonyOS] 收到上一首命令')
      callbacks.onPrevious()
    }

    const handleHarmonyOSSeek = (event: CustomEvent) => {
      const time = event.detail?.time || event.time
      console.log('[HarmonyOS] 收到跳转命令:', time)
      if (typeof time === 'number') {
        callbacks.onSeek(time)
      }
    }

    // 保存处理函数引用以便清理
    harmonyOSHandlers = {
      handleHarmonyOSPlay,
      handleHarmonyOSPause,
      handleHarmonyOSStop,
      handleHarmonyOSNext,
      handleHarmonyOSPrevious,
      handleHarmonyOSSeek
    }
    
    // 添加事件监听器
    window.addEventListener('harmonyos-play', handleHarmonyOSPlay)
    window.addEventListener('harmonyos-pause', handleHarmonyOSPause)
    window.addEventListener('harmonyos-stop', handleHarmonyOSStop)
    window.addEventListener('harmonyos-next', handleHarmonyOSNext)
    window.addEventListener('harmonyos-previous', handleHarmonyOSPrevious)
    window.addEventListener('harmonyos-seek', handleHarmonyOSSeek as EventListener)
  }

  // 清理鸿蒙系统控制事件
  const cleanupHarmonyOSControls = () => {
    if (isHarmonyOS() && harmonyOSHandlers) {
      window.removeEventListener('harmonyos-play', harmonyOSHandlers.handleHarmonyOSPlay as EventListener)
      window.removeEventListener('harmonyos-pause', harmonyOSHandlers.handleHarmonyOSPause as EventListener)
      window.removeEventListener('harmonyos-stop', harmonyOSHandlers.handleHarmonyOSStop as EventListener)
      window.removeEventListener('harmonyos-next', harmonyOSHandlers.handleHarmonyOSNext as EventListener)
      window.removeEventListener('harmonyos-previous', harmonyOSHandlers.handleHarmonyOSPrevious as EventListener)
      window.removeEventListener('harmonyos-seek', harmonyOSHandlers.handleHarmonyOSSeek as EventListener)
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