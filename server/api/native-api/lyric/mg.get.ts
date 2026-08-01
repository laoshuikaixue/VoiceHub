export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const lrcUrl = query.lrcUrl as string
  const contentId = query.contentId as string

  // 优先使用歌词URL
  if (lrcUrl) {
    try {
      const response = await fetch(lrcUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://m.music.migu.cn/'
        },
        signal: AbortSignal.timeout(8000)
      })

      if (!response.ok) {
        throw createError({
          statusCode: 502,
          message: `咪咕歌词接口返回 ${response.status}`
        })
      }

      const lrcText = await response.text()

      if (!lrcText || !lrcText.trim()) {
        throw createError({
          statusCode: 404,
          message: '歌词内容为空'
        })
      }

      return {
        success: true,
        data: {
          lrc: lrcText,
          trans: '',
          yrc: '',
          ttml: ''
        }
      }
    } catch (err: any) {
      console.error('[mg.lyric] 获取歌词失败:', err)
      throw createError({
        statusCode: err.statusCode || 500,
        message: err.message || '获取歌词失败'
      })
    }
  }

  // 如果没有提供歌词URL，通过contentId查询歌曲信息获取歌词URL
  if (contentId) {
    try {
      // 通过歌曲信息接口获取lrcUrl
      const songInfoResponse: any = await $fetch(
        `https://app.c.nf.migu.cn/resource/song/by-contentids/v2.0?contentId=${contentId}`,
        { timeout: 10000 }
      )

      const code = songInfoResponse?.code?.toString() || ''
      if (code !== '000000' || !songInfoResponse?.data?.length) {
        throw createError({
          statusCode: 404,
          message: '未找到歌曲信息'
        })
      }

      const songData = songInfoResponse.data[0]
      const songLrcUrl = songData?.lrcUrl

      if (!songLrcUrl) {
        throw createError({
          statusCode: 404,
          message: '未找到歌词链接'
        })
      }

      // 获取歌词内容
      const lrcResponse = await fetch(songLrcUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://m.music.migu.cn/'
        },
        signal: AbortSignal.timeout(8000)
      })

      if (!lrcResponse.ok) {
        throw createError({
          statusCode: 502,
          message: `咪咕歌词接口返回 ${lrcResponse.status}`
        })
      }

      const lrcText = await lrcResponse.text()

      return {
        success: true,
        data: {
          lrc: lrcText,
          trans: '',
          yrc: '',
          ttml: ''
        }
      }
    } catch (err: any) {
      console.error('[mg.lyric] 通过contentId获取歌词失败:', err)
      throw createError({
        statusCode: err.statusCode || 500,
        message: err.message || '获取歌词失败'
      })
    }
  }

  // 既没有lrcUrl也没有contentId
  throw createError({
    statusCode: 400,
    message: '缺少 lrcUrl 或 contentId 参数'
  })
})