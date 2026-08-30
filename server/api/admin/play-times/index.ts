import { asc, db, desc, playTimes } from '~/drizzle/db'
import { policies } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  await policies.canManagePlayTimes(event)

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
