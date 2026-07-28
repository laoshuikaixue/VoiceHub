import { and, db, eq, songReplayRequests } from '~/drizzle/db'
import { createApiError } from '~~/server/utils/apiError'

export default defineEventHandler(async (event) => {
  // 1. 检查用户认证
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'SONG_LOGIN_REQUIRED_CANCEL_REPLAY', '需要登录才能取消重播申请')
  }

  // 2. 读取请求体
  const body = await readBody(event)
  const { songId } = body

  if (!songId) {
    throw createApiError(400, 'SONG_ID_REQUIRED', '歌曲ID不能为空')
  }

  // 3. 检查待处理申请是否存在且属于该用户（仅允许撤回 PENDING，历史申请可能已被排期引用）
  const pendingCondition = and(
    eq(songReplayRequests.songId, songId),
    eq(songReplayRequests.userId, user.id),
    eq(songReplayRequests.status, 'PENDING')
  )

  const existing = await db.select().from(songReplayRequests).where(pendingCondition).limit(1)

  if (existing.length === 0) {
    throw createApiError(404, 'SONG_REPLAY_NOT_FOUND_OR_FORBIDDEN', '重播申请不存在或无权取消')
  }

  // 4. 删除待处理申请记录
  try {
    await db.delete(songReplayRequests).where(pendingCondition)
    return { success: true, message: '已取消重播申请' }
  } catch (error: any) {
    console.error('取消重播申请失败:', error)
    throw createApiError(500, 'SONG_REPLAY_CANCEL_FAILED', '取消重播申请失败，请稍后再试')
  }
})
