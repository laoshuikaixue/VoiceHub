import { createError, defineEventHandler, getCookie, getQuery } from 'h3'
import jwt from 'jsonwebtoken'
import { db } from '~/drizzle/db'
import { getServerTimestamp } from '~~/server/utils/serverTime'

// 存储活跃的连接及其ID
const connections = new Map()
const progressConnectionStats = { closedConnections: 0, totalLifetimeMs: 0, heartbeatFailures: 0 }

export const getProgressSseStats = () => ({
  activeConnections: connections.size,
  averageLifetimeMs: progressConnectionStats.closedConnections
    ? Math.round(progressConnectionStats.totalLifetimeMs / progressConnectionStats.closedConnections)
    : null,
  heartbeatFailures: progressConnectionStats.heartbeatFailures
})

// 为每个操作生成唯一ID
export function generateProgressId() {
  return `progress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 通过ID发送进度更新
export function sendProgressUpdate(id: string, data: any) {
  const connection = connections.get(id)
  if (connection) {
    const eventData = JSON.stringify(data)
    connection.write(`data: ${eventData}\n\n`)
  }
}

// 完成进度并关闭连接
export function completeProgress(id: string, data: any) {
  const connection = connections.get(id)
  if (connection) {
    const eventData = JSON.stringify({
      ...data,
      completed: true
    })
    connection.write(`data: ${eventData}\n\n`)

    // 给浏览器一点时间处理最后的消息
    setTimeout(() => {
      connection.write('event: close\ndata: closed\n\n')
      connections.delete(id)
    }, 100)
  }
}

// 发送错误并关闭连接
export function sendProgressError(id: string, error: string) {
  const connection = connections.get(id)
  if (connection) {
    const eventData = JSON.stringify({
      error,
      completed: true
    })
    connection.write(`data: ${eventData}\n\n`)

    // 给浏览器一点时间处理错误消息
    setTimeout(() => {
      connection.write('event: close\ndata: closed\n\n')
      connections.delete(id)
    }, 100)
  }
}

// SSE端点处理程序
export default defineEventHandler(async (event) => {
  // 获取进度ID和token
  const query = getQuery(event)
  const id = query.id as string
  const token = (query.token as string) || getCookie(event, 'auth-token')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: '缺少进度ID'
    })
  }

  if (!token) {
    throw createError({
      statusCode: 401,
      message: '缺少认证token'
    })
  }

  // 验证token
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('服务器配置错误：缺少JWT_SECRET')
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: number
      role: string
    }

    // 获取用户信息验证权限
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true }
    })

    if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        message: '需要管理员权限'
      })
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 401,
      message: '无效的认证token'
    })
  }

  // 设置SSE头
  const response = event.node.res
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no' // 禁用Nginx缓冲
  })

  // 发送初始连接成功消息
  response.write(`data: ${JSON.stringify({ connected: true, id })}\n\n`)

  // 存储连接
  const connectedAt = getServerTimestamp()
  let cleanedUp = false
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null
  connections.set(id, response)

  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    if (connections.delete(id)) {
      progressConnectionStats.closedConnections += 1
      progressConnectionStats.totalLifetimeMs += getServerTimestamp() - connectedAt
    }
    if (heartbeatInterval) clearInterval(heartbeatInterval)
  }

  // 监听客户端断开连接
  response.on('close', cleanup)
  response.on('error', cleanup)

  // 保持连接打开，直到客户端断开
  event.node.req.on('close', cleanup)
  event.node.req.on('error', cleanup)

  // 定期发送心跳以保持连接
  heartbeatInterval = setInterval(() => {
    if (!connections.has(id)) {
      cleanup()
      return
    }
    try {
      response.write(': heartbeat\n\n')
    } catch {
      progressConnectionStats.heartbeatFailures += 1
      cleanup()
    }
  }, 30000) // 每30秒发送一次心跳
})
