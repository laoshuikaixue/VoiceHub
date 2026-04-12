/**
 * Bilibili 播放链接获取接口
 * 代码参考 https://github.com/rio4raki/Bilibili-audio-extraction 优化
 * 采用 platform=html5 获取对浏览器 <audio> 标签兼容性最好的直链
 * 同时转发客户端 IP，解决海外服务器获取到错误 CDN 节点导致访问慢的问题
 */
import { defineEventHandler, getQuery, createError, getRequestHeader } from 'h3'

interface CidRes {
  code: number
  message: string
  data: {
    pages: [
      {
        cid: string
      }
    ]
  }
}

interface NoRefererPlayUrlRes {
  code: number
  message: string
  data: {
    durl: [
      {
        url: string
      }
    ]
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const bvid = query.id as string
  const cid = query.cid as string

  if (!bvid) {
    throw createError({
      statusCode: 400,
      message: '缺少 id 参数'
    })
  }

  // 提取客户端真实 IP，用于转发给 Bilibili 接口，以便分配最快 CDN 节点
  const forwardedFor = getRequestHeader(event, 'x-forwarded-for')
  const forwardedForStr = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
  const clientIp = (forwardedForStr ? forwardedForStr.split(',')[0].trim() : '') ||
                   getRequestHeader(event, 'x-real-ip') || 
                   event.node.req.socket?.remoteAddress || ''

  const headers: Record<string, string> = {
    Cookie: 'buvid3=0',
    Referer: 'https://www.bilibili.com/',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }

  if (clientIp) {
    headers['X-Forwarded-For'] = clientIp
    headers['X-Real-IP'] = clientIp
    headers['Client-IP'] = clientIp
  }

  try {
    let finalCid = cid

    if (!finalCid) {
      const target_url = 'https://api.bilibili.com/x/web-interface/view'
      const resp1 = await $fetch<CidRes>(target_url, {
        method: 'GET',
        params: { bvid },
        headers
      })

      if (!resp1?.data?.pages?.[0]?.cid) {
        throw new Error('获取 CID 失败')
      }

      finalCid = resp1.data.pages[0].cid
    }

    // 使用 platform=html5 参数绕过严格防盗链验证（允许前端使用 referrerpolicy="no-referrer"）
    const target_url2 = 'https://api.bilibili.com/x/player/playurl'

    const resp2 = await $fetch<NoRefererPlayUrlRes>(target_url2, {
      method: 'GET',
      params: {
        fnval: 1,
        platform: 'html5',
        high_quality: 1,
        bvid,
        cid: finalCid
      },
      headers
    })

    if (resp2.data?.durl?.length > 0) {
      const url = resp2.data.durl[0].url
      return { url, pay: false }
    } else {
      throw new Error(`获取歌曲链接失败: ${resp2.message || '未知错误'}`)
    }
  } catch (error: any) {
    console.error('Bilibili playurl error:', error)
    throw createError({
      statusCode: 500,
      message: error.message || '获取 Bilibili 音频链接失败'
    })
  }
})
