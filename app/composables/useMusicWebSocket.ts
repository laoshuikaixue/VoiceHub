import { onBeforeUnmount, onMounted, ref } from 'vue'

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
  const isConnected = ref(false)
  const connectionId = ref<string | null>(null)
  const lastHeartbeat = ref<number>(0)

  let eventSource: EventSource | null = null
  let reconnectTimer: NodeJS.Timeout | null = null
  let heartbeatTimer: NodeJS.Timeout | null = null

  // 事件回调
  const onStateUpdate = ref<((state: MusicState) => void) | null>(null)
  const onSongChange = ref<((songInfo: SongInfo) => void) | null>(null)
  const onPlaylistUpdate = ref<((playlist: any[]) => void) | null>(null)
  const onConnectionChange = ref<((connected: boolean) => void) | null>(null)

  // 连接WebSocket
  const connect = (token?: string) => {
    if (eventSource) {
      disconnect()
    }

    try {
      const url = new URL('/api/music/websocket', window.location.origin)
      if (token) {
        url.searchParams.set('token', token)
      }

      eventSource = new EventSource(url.toString())

      eventSource.onopen = () => {
        isConnected.value = true
        onConnectionChange.value?.(true)

        // 清除重连定时器
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
      }

      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('Music WebSocket error:', error)
        isConnected.value = false
        onConnectionChange.value?.(false)

        // 自动重连
        scheduleReconnect()
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      scheduleReconnect()
    }
  }

  // 处理消息
  const handleMessage = (message: any) => {
    const { type, data } = message

    switch (type) {
      case 'connection_established':
        connectionId.value = data.connectionId

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
    }
  }

  // 断开连接
  const disconnect = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer)
      heartbeatTimer = null
    }

    isConnected.value = false
    connectionId.value = null
    onConnectionChange.value?.(false)
  }

  // 计划重连
  const scheduleReconnect = () => {
    if (reconnectTimer) return

    reconnectTimer = setTimeout(() => {
      connect()
    }, 5000) // 5秒后重连
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
        if (timeSinceLastHeartbeat > 60000) {
          // 60秒没有心跳
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
