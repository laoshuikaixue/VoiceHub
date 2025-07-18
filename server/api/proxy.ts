import { sendError } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const { url } = getQuery(event)
    
    if (!url || typeof url !== 'string') {
      return sendError(event, createError({
        statusCode: 400,
        message: '必须提供有效的URL参数'
      }))
    }
    
    // 只允许访问特定的API域名，以确保安全
    const allowedDomains = ['api.vkeys.cn']
    const urlObj = new URL(url)
    
    if (!allowedDomains.includes(urlObj.hostname)) {
      return sendError(event, createError({
        statusCode: 403,
        message: '不允许访问此域名'
      }))
    }
    
    // 发送请求到外部API
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    if (!response.ok) {
      return sendError(event, createError({
        statusCode: response.status,
        message: `外部API请求失败: ${response.statusText}`
      }))
    }
    
    // 获取并返回响应数据
    const data = await response.json()
    return data
  } catch (error) {
    console.error('代理请求错误:', error)
    return sendError(event, createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : '代理请求处理失败'
    }))
  }
}) 