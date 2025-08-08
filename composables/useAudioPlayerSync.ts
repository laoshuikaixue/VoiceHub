import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useMusicWebSocket } from '~/composables/useMusicWebSocket'
import { useAuth } from '~/composables/useAuth'
import { useLyrics } from '~/composables/useLyrics'

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
        title: extraData.title || song.title || '未知歌曲',
        artist: extraData.artist || song.artist || '未知艺术家',
        album: extraData.album || song.album || 'VoiceHub',
        cover: extraData.artwork || coverUrl,
        duration: extraData.duration !== undefined ? extraData.duration : 0,
        position: extraData.position !== undefined ? extraData.position : 0,
        lyrics: lyrics || '' // 添加歌词字段
      }

      console.log(`[HarmonyOS] 通知动作: ${action}`, songInfo)
      
      // 如果有歌词，记录歌词信息
      if (lyrics) {
        console.log(`[HarmonyOS] 歌词信息: ${lyrics.length} 字符`)
      }

      // 只有在鸿蒙环境中才调用相关API
      if (window.voiceHubPlayer) {
        if (action === 'play') {
          window.voiceHubPlayer.onPlayStateChanged(true, {
            position: songInfo.position,
            duration: songInfo.duration
          })
          console.log('[HarmonyOS] 播放状态更新，位置:', `${songInfo.position.toFixed(1)}s`)
        } else if (action === 'pause') {
          window.voiceHubPlayer.onPlayStateChanged(false, {
            position: songInfo.position,
            duration: songInfo.duration
          })
          console.log('[HarmonyOS] 暂停状态更新，保持位置:', `${songInfo.position.toFixed(1)}s`)
        } else if (action === 'stop') {
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
          // 元数据更新时，分离元数据和播放状态更新，避免冲突
          window.voiceHubPlayer.onSongChanged(songInfo)
          // 延迟更新播放状态，确保元数据先设置完成
          setTimeout(() => {
            window.voiceHubPlayer.onPlayStateChanged(false, {
              position: songInfo.position,
              duration: songInfo.duration
            })
            // 同步播放列表状态
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
      
      console.log('[HarmonyOS] 更新播放列表状态:', playlistState)
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
      
      // 只更新进度，不改变播放状态
      notifyHarmonyOS('progress', {
        position: currentTime,
        duration: duration
      }, song)
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
    console.log('播放上一首歌曲被调用，hasPrevious:', globalAudioPlayer.hasPrevious.value)
    
    if (!globalAudioPlayer.hasPrevious.value) {
      console.log('没有上一首歌曲')
      if (window.$showNotification) {
        window.$showNotification('没有上一首歌曲', 'warning')
      }
      return { success: false, newSong: null }
    }

    try {
      console.log('尝试播放上一首歌曲...')
      const success = await globalAudioPlayer.playPrevious()
      console.log('播放上一首歌曲结果:', success)
      
      if (success) {
        const newSong = globalAudioPlayer.getCurrentSong().value
        if (newSong) {
          console.log('成功切换到上一首:', newSong.title)
          
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
            
            // 通知鸿蒙应用歌曲变化，确保元数据完整
            // 获取新歌曲的歌词
            await lyrics.loadLyrics(newSong)
            const harmonyLyrics = lyrics.getFormattedLyricsForHarmonyOS()
            notifyHarmonyOS('metadata', {
              title: newSong.title || '未知歌曲',
              artist: newSong.artist || '未知艺术家',
              album: newSong.album || '',
              artwork: newSong.cover || '',
              duration: newSong.duration || 0
            }, newSong, harmonyLyrics)
            
            // 通知播放列表状态变化
            setTimeout(() => {
              notifyPlaylistState()
            }, 100)
          }
          
          return { success: true, newSong }
        }
      } else {
        console.log('播放上一首歌曲失败')
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

  // 播放下一首歌曲
  const playNext = async (song?: any) => {
    console.log('播放下一首歌曲被调用，hasNext:', globalAudioPlayer.hasNext.value)
    
    if (!globalAudioPlayer.hasNext.value) {
      console.log('没有下一首歌曲')
      if (window.$showNotification) {
        window.$showNotification('没有下一首歌曲', 'warning')
      }
      return { success: false, newSong: null }
    }

    try {
      console.log('尝试播放下一首歌曲...')
      const success = await globalAudioPlayer.playNext()
      console.log('播放下一首歌曲结果:', success)
      
      if (success) {
        const newSong = globalAudioPlayer.getCurrentSong().value
        if (newSong) {
          console.log('成功切换到下一首:', newSong.title)
          
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
            
            // 通知鸿蒙应用歌曲变化，确保元数据完整
            // 获取新歌曲的歌词
            await lyrics.loadLyrics(newSong)
            const harmonyLyrics = lyrics.getFormattedLyricsForHarmonyOS()
            notifyHarmonyOS('metadata', {
              title: newSong.title || '未知歌曲',
              artist: newSong.artist || '未知艺术家',
              album: newSong.album || '',
              artwork: newSong.cover || '',
              duration: newSong.duration || 0
            }, newSong, harmonyLyrics)
            
            // 通知播放列表状态变化
            setTimeout(() => {
              notifyPlaylistState()
            }, 100)
          }
          
          return { success: true, newSong }
        }
      } else {
        console.log('播放下一首歌曲失败')
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
        console.log('Received WebSocket state update:', state)
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