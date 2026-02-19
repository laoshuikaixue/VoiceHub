import { db, eq, requestTimes, systemSettings } from '~/drizzle/db'
import { and, gt, lte } from 'drizzle-orm'
import { getBeijingTimeISOString } from '~/utils/timeUtils'

export default defineEventHandler(async (event) => {
  try {
    const settingsResult = await db.select().from(systemSettings).limit(1)
    const settings = settingsResult[0] || null
    let enabled = settings?.enableRequestTimeLimitation || false
    const forceBlockAllRequests = settings?.forceBlockAllRequests || false
    let hit = false
    let accepted = 0
    let expected = 0

    if (enabled) {
      const currentTime = getBeijingTimeISOString()

      const hitRequestTimeResult = await db
        .select()
        .from(requestTimes)
        .where(
          and(
            and(lte(requestTimes.startTime, currentTime), gt(requestTimes.endTime, currentTime)),
            eq(requestTimes.enabled, true)
          )
        )
        .limit(1)
      const hitRequestTime = hitRequestTimeResult[0]

      if (hitRequestTime) {
        hit = true
        accepted = hitRequestTime?.accepted || 0
        expected = hitRequestTime?.expected || 0
      }
    } else {
      hit = true
    }

    if (forceBlockAllRequests) {
      hit = false
      enabled = true
    }

    return {
      hit,
      enabled,
      accepted,
      expected
    }
  } catch (error) {
    console.error('获取播出时段失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取播出时段失败'
    })
  }
})
