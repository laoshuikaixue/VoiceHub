export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { platform, musicId, quality } = body

  if (!platform || !musicId || !quality) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameters: platform, musicId, quality'
    })
  }

  try {
    let apiUrl
    if (platform === 'netease') {
      apiUrl = `https://api.vkeys.cn/v2/music/netease?id=${musicId}&quality=${quality}`
    } else if (platform === 'tencent') {
      apiUrl = `https://api.vkeys.cn/v2/music/tencent?id=${musicId}&quality=${quality}`
    } else {
      throw createError({
        statusCode: 400,
        statusMessage: 'Unsupported music platform'
      })
    }

    // 获取音频URL
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (data.code !== 200 || !data.data?.url) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Unable to get music URL'
      })
    }

    // 返回音频URL，让客户端通过音频代理访问
    const audioUrl = data.data.url
    
    // 如果是HTTP URL，需要通过代理访问
    if (audioUrl.startsWith('http://')) {
      return {
        code: 200,
        data: {
          url: `/api/proxy/audio?url=${encodeURIComponent(audioUrl)}`,
          originalUrl: audioUrl,
          proxied: true
        }
      }
    }

    // HTTPS URL可以直接返回
    return {
      code: 200,
      data: {
        url: audioUrl,
        originalUrl: audioUrl,
        proxied: false
      }
    }
  } catch (error) {
    console.error('Music URL proxy error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get music URL: ' + error.message
    })
  }
})