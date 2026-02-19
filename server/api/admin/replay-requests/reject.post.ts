import { db, songReplayRequests, songs } from '~/drizzle/db'
import { eq, and } from 'drizzle-orm'
import { createReplayRequestRejectedNotification } from '~~/server/services/notificationService'

export default defineEventHandler(async (event) => {
  // 检查管理员权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  const body = await readBody(event)
  const { songId } = body

  if (!songId) {
    throw createError({ statusCode: 400, message: '缺少参数' })
  }

  // 获取歌曲信息用于通知
  const song = await db
    .select()
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1)
    .then((r) => r[0])
  if (!song) {
    throw createError({ statusCode: 404, message: '歌曲不存在' })
  }

  // 查找所有待处理的申请
  const pendingRequests = await db
    .select()
    .from(songReplayRequests)
    .where(and(eq(songReplayRequests.songId, songId), eq(songReplayRequests.status, 'PENDING')))

  // 更新状态
  await db
    .update(songReplayRequests)
    .set({ status: 'REJECTED' })
    .where(and(eq(songReplayRequests.songId, songId), eq(songReplayRequests.status, 'PENDING')))

  // 发送通知
  const ipAddress = getRequestIP(event, { xForwardedFor: true })
  for (const req of pendingRequests) {
    await createReplayRequestRejectedNotification(
      req.userId,
      {
        title: song.title,
        artist: song.artist
      },
      ipAddress
    )
  }

  return { success: true }
})
