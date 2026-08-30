import { getTxSongPlayableInfo, txSignedRequest } from '~~/server/utils/native_tx'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const musicId = String(query.musicId || '').trim()
  const page = Math.max(0, Number(query.page) || 0)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20))
  const type = query.type === 'latest' ? 'latest' : 'hot'
  if (!musicId) throw createError({ statusCode: 400, message: '缺少 musicId 参数' })

  const info = await getTxSongPlayableInfo(musicId)
  const topid = String(info.songId || '').trim()
  if (!topid) throw createError({ statusCode: 502, message: 'QQ 音乐歌曲 ID 无效' })

  const response = await txSignedRequest({
    comm: { ct: '19', cv: '1859', uin: '0' },
    request: {
      module: 'music.globalComment.CommentRead',
      method: type === 'hot' ? 'GetHotCommentList' : 'GetNewCommentList',
      param: {
        BizType: 1, BizId: topid, LastCommentSeqNo: '', PageSize: pageSize, PageNum: page,
        PicEnable: 1, ...(type === 'hot' ? { HotType: 1, WithAirborne: 0 } : { HashTagID: '', SelfSeeEnable: 1, AudioEnable: 1 })
      }
    }
  })

  if (!response || Number(response.code) !== 0 || Number(response.request?.code) !== 0) {
    throw createError({ statusCode: 502, message: 'QQ 音乐评论接口异常' })
  }
  const data = response.request?.data?.CommentList || response.CommentList || response.comment || {}
  const normalize = (item: any) => {
    const user = item.userinfo || item.user || {}
    const nestedReplies = item.RepliedComments || item.SubComments || item.replies || []
    const rawImages = item.Pic || item.piclist || item.picList || item.pics || item.images || item.commentpic || item.pic || item.picurl || item.picUrl || []
    const images = (Array.isArray(rawImages) ? rawImages : [rawImages])
      .map((image: any) => typeof image === 'string' ? image : image?.picurl || image?.picUrl || image?.url || image?.imageurl || '')
      .map((image: string) => image.replace(/&amp;/g, '&').replace(/^\/\//, 'https://'))
      .filter(Boolean)
    const result = {
    commentId: item.CmId ?? item.commentid ?? item.commentId ?? item.id,
    content: item.Content || item.middlecommentcontent || item.content || item.commentcontent || item.rootcommentcontent || '',
    time: Number(item.PubTime ?? item.time ?? 0) * 1000,
    likedCount: Number(item.PraiseNum ?? item.praisenum ?? item.praise_num ?? item.likedCount ?? item.praiseNum ?? 0),
    liked: false,
    images,
    user: {
      nickname: item.Nick || item.nick || item.nickname || user.nick || user.nickname || 'QQ 音乐用户',
      avatarUrl: item.Avatar || item.avatarurl || item.avatar || user.avatarurl || user.avatar || '',
      ip: item.Location || item.ip || item.userip || item.userIp || user.ip || user.userip || user.location || ''
    }
  }
    if (Array.isArray(nestedReplies) && nestedReplies.length) result.replies = nestedReplies.map((reply: any) => normalize(reply))
    return result
  }
  const groupThreads = (rawItems: any[]) => {
    const roots = new Map<string, any>()
    const replies = new Map<string, any[]>()
    for (const raw of rawItems) {
      const id = String(raw.CmId ?? raw.commentid ?? raw.commentId ?? raw.id ?? '').trim()
      const rootId = String(raw.RootCmId ?? raw.RootCommentId ?? raw.rootcommentid ?? raw.rootCommentId ?? raw.rootid ?? '').trim()
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
  const toList = (value: any) => {
    if (Array.isArray(value)) return value
    if (Array.isArray(value?.commentlist)) return value.commentlist
    if (Array.isArray(value?.list)) return value.list
    return []
  }
  const rawComments = toList(data.Comments || data.commentlist)
  const rawHotComments = toList(data.hot_comment || data.hotcommentlist || data.hotCommentList)
  const groupedComments = groupThreads([...rawHotComments, ...rawComments])
  const hotIds = new Set(rawHotComments.map((item: any) => String(item.CmId ?? item.commentid ?? item.commentId ?? item.id ?? '').trim()))
  const commentItems = groupedComments
  const hotItems = groupedComments.filter((item: any) => hotIds.has(String(item.commentId)))
  return {
    code: 200,
    data: {
      comments: commentItems,
      hotComments: hotItems.slice(0, 8),
      total: Number((data.Total ?? data.commenttotal) || 0),
      more: Boolean(data.HasMore === 1 || data.enable_more || rawComments.length === pageSize)
    }
  }
})
