import { createError, defineEventHandler } from 'h3'

// 存储活跃的连接及其ID
const connections = new Map()

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
  // 获取进度ID
  const query = getQuery(event)
  const id = query.id as string
  
  if (!id) {
    throw createError({
      statusCode: 400,
      message: '缺少进度ID'
    })
  }
  
  // 设置SSE头
  const response = event.node.res
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // 禁用Nginx缓冲
  })
  
  // 发送初始连接成功消息
  response.write(`data: ${JSON.stringify({ connected: true, id })}\n\n`)
  
  // 存储连接
  connections.set(id, response)
  
  // 监听客户端断开连接
  response.on('close', () => {
    connections.delete(id)
  })
  
  // 保持连接打开，直到客户端断开
  event.node.req.on('close', () => {
    connections.delete(id)
  })
  
  // 定期发送心跳以保持连接
  const heartbeatInterval = setInterval(() => {
    if (connections.has(id)) {
      response.write(': heartbeat\n\n')
    } else {
      clearInterval(heartbeatInterval)
    }
  }, 30000) // 每30秒发送一次心跳
}) 