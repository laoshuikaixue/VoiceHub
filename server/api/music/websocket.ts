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

// 广播音乐状态到所有连接的客户端（改进错误处理）
export function broadcastMusicState(state: MusicState) {
  const message = JSON.stringify({
    type: 'music_state_update',
    data: state
  })

  const deadConnections: string[] = []

  musicConnections.forEach((connection, id) => {
    try {
      // 检查连接是否仍然有效
      if (connection.destroyed || connection.writableEnded) {
        deadConnections.push(id)
        return
      }

      connection.write(`data: ${message}\n\n`)
    } catch (error) {
      // 忽略常见的连接错误，避免日志污染
      if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE' && error.code !== 'ENOTFOUND') {
        console.error(`Failed to send music state to connection ${id}:`, error.message)
      }
      deadConnections.push(id)
    }
  })

  // 清理死连接
  deadConnections.forEach((id) => musicConnections.delete(id))
}

// 发送播放列表更新（改进错误处理）
export function broadcastPlaylistUpdate(playlist: any[]) {
  const message = JSON.stringify({
    type: 'playlist_update',
    data: { playlist }
  })

  const deadConnections: string[] = []

  musicConnections.forEach((connection, id) => {
    try {
      if (connection.destroyed || connection.writableEnded) {
        deadConnections.push(id)
        return
      }

      connection.write(`data: ${message}\n\n`)
    } catch (error) {
      if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE' && error.code !== 'ENOTFOUND') {
        console.error(`Failed to send playlist update to connection ${id}:`, error.message)
      }
      deadConnections.push(id)
    }
  })

  deadConnections.forEach((id) => musicConnections.delete(id))
}

// 发送歌曲切换通知（改进错误处理）
export function broadcastSongChange(songInfo: any) {
  const message = JSON.stringify({
    type: 'song_change',
    data: songInfo
  })

  const deadConnections: string[] = []

  musicConnections.forEach((connection, id) => {
    try {
      if (connection.destroyed || connection.writableEnded) {
        deadConnections.push(id)
        return
      }

      connection.write(`data: ${message}\n\n`)
    } catch (error) {
      if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE' && error.code !== 'ENOTFOUND') {
        console.error(`Failed to send song change to connection ${id}:`, error.message)
      }
      deadConnections.push(id)
    }
  })

  deadConnections.forEach((id) => musicConnections.delete(id))
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
      }
    } catch (error) {
      console.warn('Invalid token for music WebSocket connection, proceeding as anonymous:', error)
      // 不抛出错误，允许匿名连接
    }
  } else {
  }

  // 生成连接ID
  const connectionId = `music_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 设置SSE头
  const response = event.node.res
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'X-Accel-Buffering': 'no'
  })

  // 发送连接成功消息
  response.write(
    `data: ${JSON.stringify({
      type: 'connection_established',
      data: {
        connectionId,
        userId,
        timestamp: Date.now()
      }
    })}\n\n`
  )

  // 存储连接
  musicConnections.set(connectionId, response)

  // 监听客户端断开连接（改进错误处理）
  const cleanup = () => {
    if (musicConnections.has(connectionId)) {
      musicConnections.delete(connectionId)
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
    }
  }

  response.on('close', cleanup)
  response.on('error', (error) => {
    // 忽略常见的连接错误
    if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
      console.error(`Music WebSocket connection ${connectionId} error:`, error.message)
    }
    cleanup()
  })

  event.node.req.on('close', cleanup)
  event.node.req.on('error', (error) => {
    // 忽略常见的连接错误
    if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
      console.error(`Music WebSocket request ${connectionId} error:`, error.message)
    }
    cleanup()
  })

  // 定期发送心跳（改进错误处理）
  const heartbeatInterval = setInterval(() => {
    if (!musicConnections.has(connectionId)) {
      clearInterval(heartbeatInterval)
      return
    }

    try {
      // 检查连接状态
      if (response.destroyed || response.writableEnded) {
        cleanup()
        return
      }

      response.write(
        `data: ${JSON.stringify({
          type: 'heartbeat',
          data: { timestamp: Date.now() }
        })}\n\n`
      )
    } catch (error) {
      // 忽略常见的连接错误
      if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
        console.error(`Heartbeat failed for connection ${connectionId}:`, error.message)
      }
      cleanup()
    }
  }, 30000) // 每30秒发送一次心跳
})
