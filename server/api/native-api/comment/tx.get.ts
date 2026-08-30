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
  const normalize = (item: any) => {
    const user = item.userinfo || item.user || {}
    const rawImages = item.piclist || item.picList || item.pics || item.images || item.commentpic || item.picurl || item.picUrl || []
    const images = (Array.isArray(rawImages) ? rawImages : [rawImages])
      .map((image: any) => typeof image === 'string' ? image : image?.picurl || image?.picUrl || image?.url || image?.imageurl || '')
      .filter(Boolean)
    return {
    commentId: item.commentid ?? item.commentId ?? item.id ?? item.rootcommentid,
    content: item.middlecommentcontent || item.content || item.commentcontent || item.rootcommentcontent || '',
    time: Number(item.time || 0) * 1000,
    likedCount: Number(item.praisenum ?? item.praise_num ?? item.likedCount ?? item.praiseNum ?? 0),
    liked: false,
    images,
    user: {
      nickname: item.nick || item.nickname || user.nick || user.nickname || 'QQ 音乐用户',
      avatarUrl: item.avatarurl || item.avatar || user.avatarurl || user.avatar || '',
      ip: item.ip || item.userip || item.userIp || user.ip || user.userip || ''
    }
  }}
  const groupThreads = (rawItems: any[]) => {
    const roots = new Map<string, any>()
    const replies = new Map<string, any[]>()
    for (const raw of rawItems) {
      const id = String(raw.commentid ?? raw.commentId ?? raw.id ?? '').trim()
      const rootId = String(raw.rootcommentid ?? raw.rootCommentId ?? '').trim()
      if (rootId && rootId !== id) {
        const reply = normalize(raw)
        replies.set(rootId, [...(replies.get(rootId) || []), reply])
      } else {
        const root = normalize(raw)
        const key = String(root.commentId || '').trim()
        if (key && !roots.has(key)) roots.set(key, root)
      }
    }
    for (const [id, root] of roots) {
      if (replies.has(id)) root.replies = replies.get(id)
    }
    return [...roots.values()]
  }
  const rawComments = Array.isArray(data.commentlist) ? data.commentlist : []
  const rawHotComments = Array.isArray(data.hot_comment || data.hotcommentlist)
    ? (data.hot_comment || data.hotcommentlist)
    : []
  const groupedComments = groupThreads([...rawHotComments, ...rawComments])
  const hotIds = new Set(rawHotComments.map((item: any) => String(item.commentid ?? item.commentId ?? item.id ?? '').trim()))
  const commentItems = groupedComments
  const hotItems = groupedComments.filter((item: any) => hotIds.has(String(item.commentId)))
  return {
    code: 200,
    data: {
      comments: commentItems,
      hotComments: hotItems.slice(0, 8),
      total: Number(data.commenttotal || 0),
      more: Boolean(data.enable_more || data.commentlist?.length === pageSize)
    }
  }
})
