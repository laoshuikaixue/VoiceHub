export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const imageUrl = query.url as string

  if (!imageUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing image URL parameter'
    })
  }

  try {
    // 验证URL是否为有效的图片URL
    const url = new URL(imageUrl)
    if (!url.protocol.startsWith('http')) {
      throw new Error('Invalid protocol')
    }

    // 获取图片
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': url.origin
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // 检查内容类型
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error('Response is not an image')
    }

    // 获取图片数据
    const imageBuffer = await response.arrayBuffer()
    
    // 设置响应头
    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Cache-Control', 'public, max-age=3600') // 缓存1小时
    setHeader(event, 'Access-Control-Allow-Origin', '*')
    
    return new Uint8Array(imageBuffer)
  } catch (error) {
    console.error('Image proxy error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch image: ' + error.message
    })
  }
})
