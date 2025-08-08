import { ref, onMounted, onBeforeUnmount } from 'vue'

interface MusicState {
  songId?: number
  isPlaying: boolean
  position: number
  duration: number
  volume: number
  playlistIndex?: number
  timestamp: number
}

interface SongInfo {
  songId?: number
  title: string
  artist: string
  cover: string
  duration: number
  playlistIndex?: number
  timestamp: number
}

export function useMusicWebSocket() {
  const socket = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const connectionId = ref<string | null>(null)
  const lastHeartbeat = ref<number>(0)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = ref(1000)
  const connectionTimeout = ref<NodeJS.Timeout | null>(null)
  const isReconnecting = ref(false)
  
  let reconnectTimer: NodeJS.Timeout | null = null
  let heartbeatTimer: NodeJS.Timeout | null = null

  // 事件回调
  const onStateUpdate = ref<((state: MusicState) => void) | null>(null)
  const onSongChange = ref<((songInfo: SongInfo) => void) | null>(null)
  const onPlaylistUpdate = ref<((playlist: any[]) => void) | null>(null)
  const onConnectionChange = ref<((connected: boolean) => void) | null>(null)

  // 连接WebSocket（改进错误处理和连接管理）
  const connect = (token?: string) => {
    // 防止重复连接
    if (isReconnecting.value) {
      console.log('🔄 正在重连中，跳过新的连接请求')
      return
    }

    try {
      const wsUrl = 'ws://localhost:3001/ws/music'
      console.log('🔌 尝试连接WebSocket:', wsUrl)
      
      // 清理现有连接
      if (socket.value) {
        socket.value.close()
        socket.value = null
      }
      
      isReconnecting.value = true
      socket.value = new WebSocket(wsUrl)
      
      // 设置连接超时
      connectionTimeout.value = setTimeout(() => {
        if (socket.value && socket.value.readyState === WebSocket.CONNECTING) {
          console.log('⏰ WebSocket连接超时，关闭连接')
          socket.value.close()
        }
      }, 10000) // 10秒超时

      socket.value.onopen = () => {
        console.log('✅ WebSocket连接成功')
        isConnected.value = true
        isReconnecting.value = false
        reconnectAttempts.value = 0
        reconnectDelay.value = 1000
        onConnectionChange.value?.(true)
        
        // 清理连接超时
        if (connectionTimeout.value) {
          clearTimeout(connectionTimeout.value)
          connectionTimeout.value = null
        }
        
        // 清除重连定时器
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
      }

      socket.value.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log('📨 收到WebSocket消息:', message)
          handleMessage(message)
        } catch (error) {
          console.error('❌ WebSocket消息解析失败:', error)
        }
      }

      socket.value.onclose = (event) => {
        console.log('🔌 WebSocket连接关闭:', event.code, event.reason)
        isConnected.value = false
        isReconnecting.value = false
        onConnectionChange.value?.(false)
        
        // 清理连接超时
        if (connectionTimeout.value) {
          clearTimeout(connectionTimeout.value)
          connectionTimeout.value = null
        }
        
        // 只有在非正常关闭时才自动重连
        if (event.code !== 1000 && reconnectAttempts.value < maxReconnectAttempts) {
          reconnectAttempts.value++
          console.log(`🔄 尝试重连 (${reconnectAttempts.value}/${maxReconnectAttempts})`)
          scheduleReconnect()
        } else if (event.code !== 1000) {
          console.error('❌ WebSocket重连失败，已达到最大重试次数')
        }
      }
      
      socket.value.onerror = (error) => {
        console.error('❌ WebSocket错误:', error)
        isConnected.value = false
        isReconnecting.value = false
        
        // 清理连接超时
        if (connectionTimeout.value) {
          clearTimeout(connectionTimeout.value)
          connectionTimeout.value = null
        }
      }

    } catch (error) {
      console.error('❌ WebSocket连接失败:', error)
      isReconnecting.value = false
      scheduleReconnect()
    }
  }

  // 处理消息
  const handleMessage = (message: any) => {
    const { type, data } = message

    switch (type) {
      case 'connection_established':
        connectionId.value = data.connectionId
        console.log('Music WebSocket connection established:', data.connectionId)
        break

      case 'music_state_update':
        onStateUpdate.value?.(data)
        break

      case 'song_change':
        onSongChange.value?.(data)
        break

      case 'playlist_update':
        onPlaylistUpdate.value?.(data.playlist)
        break

      case 'heartbeat':
        lastHeartbeat.value = data.timestamp
        break

      default:
        console.log('Unknown WebSocket message type:', type)
    }
  }

  // 断开连接
  const disconnect = () => {
    if (socket.value) {
      socket.value.close(1000, 'Normal closure')
      socket.value = null
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer)
      heartbeatTimer = null
    }
    
    if (connectionTimeout.value) {
      clearTimeout(connectionTimeout.value)
      connectionTimeout.value = null
    }

    isConnected.value = false
    isReconnecting.value = false
    reconnectAttempts.value = 0
    connectionId.value = null
    onConnectionChange.value?.(false)
  }

  // 计划重连
  const scheduleReconnect = () => {
    if (reconnectTimer || isReconnecting.value) return

    reconnectTimer = setTimeout(() => {
      console.log('🔄 尝试重新连接 WebSocket...')
      connect()
    }, reconnectDelay.value)
    
    reconnectDelay.value = Math.min(reconnectDelay.value * 2, 30000)
  }

  // 发送音乐状态更新
  const sendStateUpdate = async (state: Partial<MusicState>) => {
    try {
      await $fetch('/api/music/state', {
        method: 'POST',
        body: {
          type: 'state_update',
          data: state
        }
      })
    } catch (error) {
      console.error('Failed to send music state update:', error)
    }
  }

  // 发送歌曲切换通知
  const sendSongChange = async (songInfo: Partial<SongInfo>) => {
    try {
      await $fetch('/api/music/state', {
        method: 'POST',
        body: {
          type: 'song_change',
          data: songInfo
        }
      })
    } catch (error) {
      console.error('Failed to send song change:', error)
    }
  }

  // 发送播放位置更新
  const sendPositionUpdate = async (position: number, duration: number, songId?: number) => {
    try {
      await $fetch('/api/music/state', {
        method: 'POST',
        body: {
          type: 'position_update',
          data: {
            songId,
            position,
            duration,
            isPlaying: true
          }
        }
      })
    } catch (error) {
      console.error('Failed to send position update:', error)
    }
  }

  // 设置事件监听器
  const setStateUpdateListener = (callback: (state: MusicState) => void) => {
    onStateUpdate.value = callback
  }

  const setSongChangeListener = (callback: (songInfo: SongInfo) => void) => {
    onSongChange.value = callback
  }

  const setPlaylistUpdateListener = (callback: (playlist: any[]) => void) => {
    onPlaylistUpdate.value = callback
  }

  const setConnectionChangeListener = (callback: (connected: boolean) => void) => {
    onConnectionChange.value = callback
  }

  // 生命周期管理
  onMounted(() => {
    // 启动心跳检测
    heartbeatTimer = setInterval(() => {
      if (isConnected.value && lastHeartbeat.value > 0) {
        const timeSinceLastHeartbeat = Date.now() - lastHeartbeat.value
        if (timeSinceLastHeartbeat > 60000) { // 60秒没有心跳
          console.warn('Music WebSocket heartbeat timeout, reconnecting...')
          disconnect()
          scheduleReconnect()
        }
      }
    }, 30000) // 每30秒检查一次
  })

  onBeforeUnmount(() => {
    disconnect()
  })

  return {
    isConnected: readonly(isConnected),
    connectionId: readonly(connectionId),
    connect,
    disconnect,
    sendStateUpdate,
    sendSongChange,
    sendPositionUpdate,
    setStateUpdateListener,
    setSongChangeListener,
    setPlaylistUpdateListener,
    setConnectionChangeListener
  }
}