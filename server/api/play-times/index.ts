import { asc, db, eq, playTimes } from '~/drizzle/db'
import type { PlayTime } from '~/drizzle/schema'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { normalizeWeekdays } from '~~/server/utils/play-slot'

export default defineEventHandler(async (event) => {
  try {
    // 获取系统设置，检查是否启用播出时段选择
    const settings = await getSystemSettingsCached()
    const enabled = settings?.enablePlayTimeSelection || false
    // 点歌时是否强制选择播出日期 + 时段（全局总开关）
    const required = enabled && (settings?.playSlotRequired || false)

    // 如果启用了播出时段选择，则获取所有启用的播出时段
    let playTimesData: PlayTime[] = []
    if (enabled) {
      playTimesData = await db
        .select()
        .from(playTimes)
        .where(eq(playTimes.enabled, true))
        .orderBy(asc(playTimes.startTime))
    }

    // 默认时段：投稿时用户未选择时段则预选它；功能关闭或不启用时为 null
    const defaultPlayTime = playTimesData.find((pt) => pt.isDefault) ?? null

    return {
      enabled,
      required,
      defaultPlayTimeId: defaultPlayTime ? defaultPlayTime.id : null,
      // weekdays: null = 每天均可选（未配置）；数组 = 仅这些星期可选（0=周日…6=周六）
      playTimes: playTimesData.map((pt) => ({
        ...pt,
        weekdays: normalizeWeekdays(pt.weekdays)
      }))
    }
  } catch (error) {
    console.error('获取播出时段失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取播出时段失败'
    })
  }
})
