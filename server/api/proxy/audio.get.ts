export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const audioUrl = query.url as string

  if (!audioUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing audio URL parameter'
    })
  }

  try {
    // 验证URL
    const url = new URL(audioUrl)
    if (!url.protocol.startsWith('http')) {
      throw new Error('Invalid protocol')
    }

    // 获取音频文件
    const response = await fetch(audioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': url.origin,
        'Range': getHeader(event, 'range') || '' // 支持断点续传
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // 获取内容类型
    const contentType = response.headers.get('content-type') || 'audio/mpeg'
    const contentLength = response.headers.get('content-length')
    const acceptRanges = response.headers.get('accept-ranges')
    const contentRange = response.headers.get('content-range')

    // 设置响应头
    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Cache-Control', 'public, max-age=3600') // 缓存1小时
    setHeader(event, 'Access-Control-Allow-Origin', '*')
    setHeader(event, 'Access-Control-Allow-Headers', 'Range')
    setHeader(event, 'Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
    
    if (contentLength) {
      setHeader(event, 'Content-Length', contentLength)
    }
    
    if (acceptRanges) {
      setHeader(event, 'Accept-Ranges', acceptRanges)
    }
    
    if (contentRange) {
      setHeader(event, 'Content-Range', contentRange)
    }

    // 设置状态码（支持206 Partial Content）
    if (response.status === 206) {
      setResponseStatus(event, 206)
    }

    // 返回音频流
    const audioBuffer = await response.arrayBuffer()
    return new Uint8Array(audioBuffer)
  } catch (error) {
    console.error('Audio proxy error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch audio: ' + error.message
    })
  }
})