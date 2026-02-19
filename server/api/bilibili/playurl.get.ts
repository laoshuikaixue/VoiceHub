/**
 * Bilibili 播放链接获取接口
 * 代码参考 https://github.com/ljk743121/Sound-of-experiment/blob/v4/server/utils/plugins/bilibili.ts
 */
import { defineEventHandler, getQuery, createError } from 'h3'

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
      statusMessage: 'Missing id parameter'
    })
  }

  const headers = {
    Cookie: 'buvid3=0',
    Referer: 'https://www.bilibili.com/',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
        throw new Error('Failed to get CID')
      }

      finalCid = resp1.data.pages[0].cid
    }

    // 使用 platform=html5 参数绕过防盗链验证
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
      throw new Error('获取歌曲链接失败')
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch bilibili track url'
    })
  }
})
