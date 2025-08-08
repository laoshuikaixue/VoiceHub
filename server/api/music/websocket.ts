import { defineEventHandler, getQuery } from 'h3'
import jwt from 'jsonwebtoken'

// 存储WebSocket连接
const musicConnections = new Map<string, any>()

// 音乐状态接口
interface MusicState {
  songId?: number
  isPlaying: boolean
  position: number
  duration: number
  volume: number
  playlistIndex?: number
  timestamp: number
}

// 广播音乐状态到所有连接的客户端
export function broadcastMusicState(state: MusicState) {
  const message = JSON.stringify({
    type: 'music_state_update',
    data: state
  })

  musicConnections.forEach((connection, id) => {
    try {
      connection.write(`data: ${message}\n\n`)
    } catch (error) {
      console.error(`Failed to send music state to connection ${id}:`, error)
      musicConnections.delete(id)
    }
  })
}

// 发送播放列表更新
export function broadcastPlaylistUpdate(playlist: any[]) {
  const message = JSON.stringify({
    type: 'playlist_update',
    data: { playlist }
  })

  musicConnections.forEach((connection, id) => {
    try {
      connection.write(`data: ${message}\n\n`)
    } catch (error) {
      console.error(`Failed to send playlist update to connection ${id}:`, error)
      musicConnections.delete(id)
    }
  })
}

// 发送歌曲切换通知
export function broadcastSongChange(songInfo: any) {
  const message = JSON.stringify({
    type: 'song_change',
    data: songInfo
  })

  musicConnections.forEach((connection, id) => {
    try {
      connection.write(`data: ${message}\n\n`)
    } catch (error) {
      console.error(`Failed to send song change to connection ${id}:`, error)
      musicConnections.delete(id)
    }
  })
}

// WebSocket事件处理器
export default defineEventHandler(async (event) => {
  // 获取查询参数
  const query = getQuery(event)
  const token = query.token as string

  // 验证token（可选，根据需要决定是否需要认证）
  let userId: number | null = null
  if (token) {
    try {
      if (process.env.JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: number }
        userId = decoded.userId
        console.log('Music WebSocket authenticated user:', userId)
      }
    } catch (error) {
      console.warn('Invalid token for music WebSocket connection, proceeding as anonymous:', error)
      // 不抛出错误，允许匿名连接
    }
  } else {
    console.log('Music WebSocket connection without token, proceeding as anonymous')
  }

  // 生成连接ID
  const connectionId = `music_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 设置SSE头
  const response = event.node.res
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'X-Accel-Buffering': 'no'
  })

  // 发送连接成功消息
  response.write(`data: ${JSON.stringify({
    type: 'connection_established',
    data: { 
      connectionId,
      userId,
      timestamp: Date.now()
    }
  })}\n\n`)

  // 存储连接
  musicConnections.set(connectionId, response)

  // 监听客户端断开连接
  response.on('close', () => {
    musicConnections.delete(connectionId)
    console.log(`Music WebSocket connection ${connectionId} closed`)
  })

  event.node.req.on('close', () => {
    musicConnections.delete(connectionId)
    console.log(`Music WebSocket connection ${connectionId} closed by client`)
  })

  // 定期发送心跳
  const heartbeatInterval = setInterval(() => {
    if (musicConnections.has(connectionId)) {
      try {
        response.write(`data: ${JSON.stringify({
          type: 'heartbeat',
          data: { timestamp: Date.now() }
        })}\n\n`)
      } catch (error) {
        clearInterval(heartbeatInterval)
        musicConnections.delete(connectionId)
      }
    } else {
      clearInterval(heartbeatInterval)
    }
  }, 30000) // 每30秒发送一次心跳

  console.log(`Music WebSocket connection ${connectionId} established for user ${userId || 'anonymous'}`)
})