import { and, db, eq, songReplayRequests } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  // 1. 检查用户认证
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '需要登录才能取消重播申请' })
  }

  // 2. 读取请求体
  const body = await readBody(event)
  const { songId } = body

  if (!songId) {
    throw createError({ statusCode: 400, message: '歌曲ID不能为空' })
  }

  // 3. 检查申请是否存在且属于该用户
  const existing = await db
    .select()
    .from(songReplayRequests)
    .where(and(eq(songReplayRequests.songId, songId), eq(songReplayRequests.userId, user.id)))
    .limit(1)

  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '重播申请不存在或无权取消' })
  }

  // 4. 删除申请记录
  try {
    await db
      .delete(songReplayRequests)
      .where(and(eq(songReplayRequests.songId, songId), eq(songReplayRequests.userId, user.id)))
    return { success: true, message: '已取消重播申请' }
  } catch (error: any) {
    console.error('取消重播申请失败:', error)
    throw createError({ statusCode: 500, message: '取消重播申请失败，请稍后再试' })
  }
})
