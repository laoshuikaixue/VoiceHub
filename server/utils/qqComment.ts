const MAX_REPLY_DEPTH = 8

export const buildQqCommentRequestParam = ({
  topid,
  cursor,
  page,
  pageSize,
  type
}: {
  topid: string
  cursor: string
  page: number
  pageSize: number
  type: 'hot' | 'latest'
}) => ({
  BizType: 1,
  BizId: topid,
  LastCommentSeqNo: cursor,
  PageSize: pageSize,
  PageNum: page,
  PicEnable: 1,
  ...(type === 'hot'
    ? { HotType: 1, WithAirborne: 0 }
    : { HashTagID: '', SelfSeeEnable: 1, AudioEnable: 1 })
})

const optionalString = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

// QQ 评论正文的换行以字面量 \n 两个字符返回，需还原为真实换行
const unescapeLiteralNewlines = (text: string) => text.replace(/\\r\\n|\\n|\\r/g, '\n')

const normalizeImageUrl = (value: unknown): string => {
  const text = optionalString(value).replace(/&amp;/gi, '&')
  if (!text) return ''
  if (text.startsWith('//')) return `https:${text}`
  if (text.startsWith('http://')) return `https://${text.slice(7)}`
  return /^https:\/\//i.test(text) ? text : ''
}

const collectImageUrls = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : [value]
  const urls = values
    .map((item) => {
      if (typeof item === 'string') return normalizeImageUrl(item)
      if (!item || typeof item !== 'object') return ''

      const image = item as Record<string, unknown>
      return normalizeImageUrl(
        image.url || image.picurl || image.picUrl || image.imageurl || image.imageUrl
      )
    })
    .filter(Boolean)

  return [...new Set(urls)]
}

const getCommentId = (item: Record<string, unknown>): string =>
  optionalString(item.CmId ?? item.commentId ?? item.commentid ?? item.id)

const getRootCommentId = (item: Record<string, unknown>): string => {
  const root =
    item.RootCmId ??
    item.RootCommentId ??
    item.rootCommentId ??
    item.rootcommentid ??
    item.rootid ??
    item.RootComment ??
    item.rootComment
  if (root && typeof root === 'object') return getCommentId(root as Record<string, unknown>)
  return optionalString(root)
}

const getParentCommentId = (item: Record<string, unknown>): string =>
  (() => {
    const parent =
      item.ParentCmId ??
      item.ParentCommentId ??
      item.parentCommentId ??
      item.parentcommentid ??
      item.parentid ??
      item.ParentComment
    if (parent && typeof parent === 'object') return getCommentId(parent)
    return optionalString(parent)
  })()

const getNestedReplies = (item: Record<string, unknown>): Array<Record<string, unknown>> => {
  const replies = [
    ...(Array.isArray(item.RepliedComments) ? item.RepliedComments : []),
    ...(Array.isArray(item.SubComments) ? item.SubComments : []),
    ...(Array.isArray(item.SubCmListV1) ? item.SubCmListV1 : [])
  ]
  const seen = new Set<string>()
  return replies.filter((reply) => {
    if (!reply || typeof reply !== 'object') return false
    const id = getCommentId(reply)
    if (id && seen.has(id)) return false
    if (id) seen.add(id)
    return true
  })
}

const normalizeTimestamp = (value: unknown): number => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0
  return timestamp >= 1_000_000_000_000 ? timestamp : timestamp * 1000
}

export interface QqCommentItem {
  commentId: string
  content: string
  time: number
  likedCount: number
  liked: boolean
  replyCount: number
  images: string[]
  emojis: string[]
  replies: QqCommentItem[]
  user: {
    nickname: string
    avatarUrl: string
    location: string
  }
}

export const normalizeQqComment = (
  raw: unknown,
  parentIds = new Set<string>(),
  depth = 0
): QqCommentItem | null => {
  if (!raw || typeof raw !== 'object' || depth > MAX_REPLY_DEPTH) return null

  const item = raw as Record<string, unknown>
  const commentId = getCommentId(item)
  const content = unescapeLiteralNewlines(
    optionalString(item.Content ?? item.content ?? item.middlecommentcontent ?? item.commentcontent)
  )
  if (!commentId || !content || parentIds.has(commentId)) return null

  const nextParentIds = new Set(parentIds)
  nextParentIds.add(commentId)
  const replyIds = new Set<string>()
  const replies = getNestedReplies(item)
    .map((reply) => normalizeQqComment(reply, nextParentIds, depth + 1))
    .filter((reply): reply is QqCommentItem => {
      if (!reply || replyIds.has(reply.commentId)) return false
      replyIds.add(reply.commentId)
      return true
    })

  const userSource = item.userinfo || item.user
  const user =
    userSource && typeof userSource === 'object'
      ? (userSource as Record<string, unknown>)
      : {}
  return {
    commentId,
    content,
    time: normalizeTimestamp(item.PubTime ?? item.time),
    likedCount: Number(item.PraiseNum ?? item.praisenum ?? item.likedCount ?? 0) || 0,
    liked: Boolean(item.IsPraised ?? item.liked),
    replyCount: Number(item.ReplyCnt ?? item.replyCount ?? replies.length) || replies.length,
    images: collectImageUrls(item.Pic ?? item.pic ?? item.images),
    emojis: collectImageUrls(item.EmoPic ?? item.emoPic),
    replies,
    user: {
      nickname:
        optionalString(item.Nick ?? item.nick ?? item.nickname ?? user.nickname) || 'QQ 音乐用户',
      avatarUrl: normalizeImageUrl(item.Avatar ?? item.avatar ?? item.avatarurl ?? user.avatarUrl),
      location: optionalString(item.Location ?? item.location ?? user.location)
    }
  }
}

const collectReplyIds = (items: QqCommentItem[], result = new Set<string>()): Set<string> => {
  for (const item of items) {
    for (const reply of item.replies) {
      result.add(reply.commentId)
      collectReplyIds(reply.replies, result)
    }
  }
  return result
}

export const normalizeQqCommentList = (rawItems: unknown): QqCommentItem[] => {
  if (!Array.isArray(rawItems)) return []

  const candidates = rawItems
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null
      const source = raw as Record<string, unknown>
      const item = normalizeQqComment(source)
      if (!item) return null
      return {
        item,
        rootId: getRootCommentId(source),
        parentId: getParentCommentId(source)
      }
    })
    .filter((candidate): candidate is { item: QqCommentItem; rootId: string; parentId: string } =>
      Boolean(candidate)
    )

  const normalizedById = new Map<string, QqCommentItem>()
  for (const { item } of candidates) {
    if (!normalizedById.has(item.commentId)) normalizedById.set(item.commentId, item)
  }

  const explicitReplyIds = new Set<string>()
  for (const { item, rootId, parentId } of candidates) {
    const targetId = rootId || parentId
    if (!targetId || targetId === item.commentId) continue

    explicitReplyIds.add(item.commentId)
    const target = normalizedById.get(targetId)
    if (!target || target.commentId === item.commentId) continue
    if (collectReplyIds([item]).has(target.commentId)) continue

    const existingReplyIds = collectReplyIds([target])
    if (!existingReplyIds.has(item.commentId)) {
      target.replies.push(item)
      target.replyCount = Math.max(target.replyCount, target.replies.length)
    }
  }

  const normalized = [...normalizedById.values()]
  const nestedReplyIds = collectReplyIds(normalized)
  const rootIds = new Set<string>()

  return normalized.filter((item) => {
    if (
      explicitReplyIds.has(item.commentId) ||
      nestedReplyIds.has(item.commentId) ||
      rootIds.has(item.commentId)
    ) {
      return false
    }
    rootIds.add(item.commentId)
    return true
  })
}

export const normalizeQqCommentPage = (rawItems: unknown) => {
  const items = Array.isArray(rawItems) ? rawItems : []
  const ids = new Set(
    items
      .filter((item) => item && typeof item === 'object')
      .map((item) => getCommentId(item as Record<string, unknown>))
      .filter(Boolean)
  )
  const orphanReplies = items
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null
      const source = raw as Record<string, unknown>
      const rootCommentId = getRootCommentId(source) || getParentCommentId(source)
      const commentId = getCommentId(source)
      if (!rootCommentId || rootCommentId === commentId || ids.has(rootCommentId)) return null
      const item = normalizeQqComment(source)
      return item ? { ...item, rootCommentId } : null
    })
    .filter((item): item is QqCommentItem & { rootCommentId: string } => Boolean(item))

  return {
    comments: normalizeQqCommentList(items),
    orphanReplies
  }
}
