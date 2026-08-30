import { getTxSongPlayableInfo } from '~~/server/utils/native_tx'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const musicId = String(query.musicId || '').trim()
  const page = Math.max(0, Number(query.page) || 0)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20))
  if (!musicId) throw createError({ statusCode: 400, message: '缺少 musicId 参数' })

  const info = await getTxSongPlayableInfo(musicId)
  const topid = String(info.songId || '').trim()
  if (!topid) throw createError({ statusCode: 502, message: 'QQ 音乐歌曲 ID 无效' })

  const response = await $fetch<any>('https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg', {
    params: {
      g_tk: 5381,
      loginUin: 0,
      hostUin: 0,
      format: 'json',
      inCharset: 'utf8',
      outCharset: 'utf-8',
      notice: 0,
      platform: 'yqq.json',
      needNewCode: 0,
      cid: 205360772,
      reqtype: 2,
      biztype: 1,
      topid,
      cmd: 8,
      needmusiccrit: 1,
      pagenum: page,
      pagesize: pageSize,
      lasthotcommentid: 0,
      domain: 'qq.com'
    },
    headers: { Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0' },
    responseType: 'json',
    signal: AbortSignal.timeout(8000)
  })

  if (!response || Number(response.code) !== 0) {
    throw createError({ statusCode: 502, message: 'QQ 音乐评论接口异常' })
  }
  const data = response.comment || {}
  const normalize = (item: any) => ({
    commentId: item.commentid ?? item.id,
    content: item.content || '',
    time: Number(item.time || 0) * 1000,
    likedCount: Number(item.praisenum || item.likedCount || 0),
    liked: false,
    user: {
      nickname: item.nick || item.nickname || 'QQ 音乐用户',
      avatarUrl: item.avatarurl || item.avatar || ''
    }
  })
  return {
    code: 200,
    data: {
      comments: Array.isArray(data.commentlist) ? data.commentlist.map(normalize) : [],
      hotComments: Array.isArray(data.hot_comment || data.hotcommentlist)
        ? (data.hot_comment || data.hotcommentlist).slice(0, 8).map(normalize)
        : [],
      total: Number(data.commenttotal || 0),
      more: Boolean(data.enable_more || data.commentlist?.length === pageSize)
    }
  }
})
