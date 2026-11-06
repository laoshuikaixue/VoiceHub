import { asc, db, desc, playTimes } from '~/drizzle/db'

export default defineEventHandler(async () => {
  try {
    const playTimesResult = await db
      .select()
      .from(playTimes)
      .orderBy(desc(playTimes.isDefault), desc(playTimes.enabled), asc(playTimes.startTime))

    return playTimesResult
  } catch (error) {
    console.error('获取播出时段失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取播出时段失败'
    })
  }
})
