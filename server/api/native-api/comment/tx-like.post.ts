import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import { parseQqCommentPraiseResult } from '~~/server/utils/qqComment'
import { getQqWebSession, updateQqCommentPraise } from '~~/server/utils/qq_music_sdk'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const commentId = String(body?.commentId || '').trim()
  const cookie = String(body?.cookie || '').trim()
  const liked = body?.liked !== false
  if (!commentId) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少评论 ID')
  }
  if (!cookie) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_SESSION_EXPIRED, '请先登录 QQ 音乐')
  }

  const session = getQqWebSession(cookie)
  if (!session.uin) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_SESSION_EXPIRED, 'QQ 音乐登录状态无效')
  }

  let response
  try {
    response = await updateQqCommentPraise({
      commentId,
      liked,
      cookie: session.cookie,
      uin: session.uin
    })
  } catch (error) {
    console.error('[QQ评论] 点赞请求失败:', error instanceof Error ? error.message : error)
    throw createApiError(502, SERVER_ERROR_CODES.QQ_COMMENT_LIKE_FAILED, 'QQ 音乐评论点赞失败')
  }
  const result = parseQqCommentPraiseResult(response)

  if (result.sessionExpired) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_SESSION_EXPIRED, 'QQ 音乐登录状态已失效')
  }
  if (!result.ok) {
    throw createApiError(
      502,
      SERVER_ERROR_CODES.QQ_COMMENT_LIKE_FAILED,
      result.message || 'QQ 音乐评论点赞失败'
    )
  }

  return { code: 200, data: { liked } }
})
