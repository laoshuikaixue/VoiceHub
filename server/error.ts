import type { NitroErrorHandler } from 'nitropack'

const errorHandler: NitroErrorHandler = async (error, event) => {
  // 记录错误详情
  console.error('Nitro Error Handler:', {
    url: event.node.req.url,
    method: event.node.req.method,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  })

  // 检查是否是数据库连接错误
  const isDatabaseError =
    error.message.includes('ECONNRESET') ||
    error.message.includes('ENOTFOUND') ||
    error.message.includes('ETIMEDOUT') ||
    error.message.includes('Connection terminated') ||
    error.message.includes('Connection lost') ||
    error.message.includes('Prisma')

  if (isDatabaseError) {
    console.log('Database error detected in error handler')

    // 返回数据库错误响应
    return {
      statusCode: 503,
      statusMessage: 'Service Temporarily Unavailable',
      data: {
        error: 'Database connection issue',
        message: '数据库连接暂时不可用，请稍后重试',
        timestamp: new Date().toISOString(),
        retryAfter: 30 // 建议30秒后重试
      }
    }
  }

  // 根据错误类型返回不同的响应
  if (error.statusCode) {
    return {
      statusCode: error.statusCode,
      statusMessage: error.statusMessage || 'Error',
      data: {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  }

  // 默认服务器错误
  return {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    data: {
      error: '服务器内部错误',
      message: '服务暂时不可用，请稍后重试',
      timestamp: new Date().toISOString()
    }
  }
}

export default errorHandler
