import { asc, db, desc, requestTimes } from '~/drizzle/db'
import { lt } from 'drizzle-orm'
import { getBeijingTimeISOString } from '~/utils/timeUtils'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能管理投稿开放时段'
    })
  }

  try {
    await db
      .update(requestTimes)
      .set({ past: true })
      .where(lt(requestTimes.endTime, getBeijingTimeISOString()))
    const requestTimesResult = await db
      .select()
      .from(requestTimes)
      .orderBy(desc(requestTimes.enabled), asc(requestTimes.startTime))

    return requestTimesResult
  } catch (error) {
    console.error('获取投稿开放时段失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取投稿开放时段失败'
    })
  }
})
