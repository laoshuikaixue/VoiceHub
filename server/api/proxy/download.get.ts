import { defineEventHandler, getQuery, createError, setHeader, sendStream } from 'h3'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const fileUrl = query.url as string

  if (!fileUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing file URL parameter'
    })
  }

  try {
    // 验证URL
    const url = new URL(fileUrl)
    if (!url.protocol.startsWith('http')) {
      throw new Error('Invalid protocol')
    }

    // 确定 Referer
    let referer = url.origin
    // 针对 Bilibili 的特殊处理
    if (url.hostname.includes('bilivideo.com') || url.hostname.includes('hdslb.com') || url.hostname.includes('bilibili.com') || url.hostname.includes('googlevideo.com')) {
        referer = 'https://www.bilibili.com/'
    }
    // 针对网易云音乐的特殊处理
    else if (url.hostname.includes('126.net') || url.hostname.includes('163.com')) {
        referer = 'https://music.163.com/'
    }
    // 针对 QQ 音乐的特殊处理
    else if (url.hostname.includes('qqmusic.qq.com') || url.hostname.includes('music.qq.com') || url.hostname.includes('y.qq.com')) {
        referer = 'https://y.qq.com/'
    }

    // 请求头
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Referer': referer,
      'Range': event.headers.get('range') || undefined // 支持断点续传/Range请求
    }
    // 移除 undefined 的 header
    Object.keys(headers).forEach(key => headers[key] === undefined && delete headers[key])

    // 发起请求
    const response = await fetch(fileUrl, { headers })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // 设置响应头
    const contentType = response.headers.get('content-type')
    if (contentType) {
      setHeader(event, 'Content-Type', contentType)
    }
    
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      setHeader(event, 'Content-Length', contentLength)
    }
    
    const contentRange = response.headers.get('content-range')
    if (contentRange) {
        setHeader(event, 'Content-Range', contentRange)
        event.node.res.statusCode = 206
    }

    setHeader(event, 'Access-Control-Allow-Origin', '*')
    
    // 使用 sendStream 流式返回
    return sendStream(event, response.body as any)

  } catch (error: any) {
    console.error('Download proxy error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to download file'
    })
  }
})
