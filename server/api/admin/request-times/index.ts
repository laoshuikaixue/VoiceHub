import { asc, db, desc, requestTimes } from '~/drizzle/db'
import { lt } from 'drizzle-orm'
import { getBeijingTimeISOString } from '~/utils/timeUtils'
import { policies } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  await policies.canManageRequestTimes(event)

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
