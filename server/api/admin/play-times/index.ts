import { asc, db, desc, playTimes } from '~/drizzle/db'
import { canManagePlayTimes } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  // 权限：playtimes.manage（SONG_ADMIN 及以上）
  await canManagePlayTimes(event)

  try {
    const playTimesResult = await db
      .select()
      .from(playTimes)
      .orderBy(desc(playTimes.enabled), asc(playTimes.startTime))

    return playTimesResult
  } catch (error) {
    console.error('获取播出时段失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取播出时段失败'
    })
  }
})
