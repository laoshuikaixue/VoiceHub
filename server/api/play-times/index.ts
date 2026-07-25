import { asc, db, eq, playTimes } from '~/drizzle/db'
import type { PlayTime } from '~/drizzle/schema'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'

export default defineEventHandler(async (event) => {
  try {
    // 获取系统设置，检查是否启用播出时段选择
    const settings = await getSystemSettingsCached()
    const enabled = settings?.enablePlayTimeSelection || false

    // 如果启用了播出时段选择，则获取所有启用的播出时段
    let playTimesData: PlayTime[] = []
    if (enabled) {
      playTimesData = await db
        .select()
        .from(playTimes)
        .where(eq(playTimes.enabled, true))
        .orderBy(asc(playTimes.startTime))
    }

    return {
      enabled,
      playTimes: playTimesData
    }
  } catch (error) {
    console.error('获取播出时段失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取播出时段失败'
    })
  }
})
