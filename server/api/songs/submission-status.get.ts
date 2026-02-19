import { db } from '~/drizzle/db'
import { requestTimes, songs, systemSettings } from '~/drizzle/schema'
import { and, count, eq, gt, gte, lt, lte } from 'drizzle-orm'
import { getBeijingTimeISOString } from '~/utils/timeUtils'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能查看投稿状态'
    })
  }

  try {
    // 获取系统设置
    const systemSettingsResult = await db.select().from(systemSettings).limit(1)
    const systemSettingsData = systemSettingsResult[0]

    // 超级管理员和管理员不受投稿限制
    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'

    // 基础返回结构
    const status: any = {
      limitEnabled: systemSettingsData?.enableSubmissionLimit || false,
      dailyLimit: null,
      weeklyLimit: null,
      dailyUsed: 0,
      weeklyUsed: 0,
      dailyRemaining: null,
      weeklyRemaining: null,
      submissionClosed: false,
      timeLimitationEnabled: systemSettingsData?.enableRequestTimeLimitation || false,
      currentTimePeriod: null
    }

    // 检查投稿时段限制
    if (status.timeLimitationEnabled) {
      const currentTime = getBeijingTimeISOString()

      const activeTimePeriod = await db
        .select()
        .from(requestTimes)
        .where(
          and(
            lte(requestTimes.startTime, currentTime),
            gt(requestTimes.endTime, currentTime),
            eq(requestTimes.enabled, true)
          )
        )
        .limit(1)

      if (activeTimePeriod.length > 0) {
        status.currentTimePeriod = activeTimePeriod[0]
      } else if (!isAdmin) {
        // 如果没有活跃时段且不是管理员，则视为投稿已关闭
        status.submissionClosed = true
      }
    }

    if (!status.limitEnabled) {
      return status
    }

    // 确定生效的限额类型（二选一逻辑）
    const dailyLimit = systemSettingsData.dailySubmissionLimit
    const weeklyLimit = systemSettingsData.weeklySubmissionLimit

    let effectiveLimit = null
    let limitType = null

    if (dailyLimit !== null && dailyLimit !== undefined) {
      effectiveLimit = dailyLimit
      limitType = 'daily'
    } else if (weeklyLimit !== null && weeklyLimit !== undefined) {
      effectiveLimit = weeklyLimit
      limitType = 'weekly'
    }

    // 检查是否设置了限额为0（关闭投稿）
    if (effectiveLimit === 0) {
      status.dailyLimit = limitType === 'daily' ? effectiveLimit : null
      status.weeklyLimit = limitType === 'weekly' ? effectiveLimit : null
      status.dailyRemaining = 0
      status.weeklyRemaining = 0
      status.submissionClosed = !isAdmin // 管理员不受投稿关闭限制
      return status
    }

    const now = new Date()

    // 只计算生效的限额类型的使用量
    let dailyUsed = 0
    let weeklyUsed = 0

    if (limitType === 'daily' && effectiveLimit > 0) {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

      const dailyUsedResult = await db
        .select({ count: count() })
        .from(songs)
        .where(
          and(
            eq(songs.requesterId, user.id),
            gte(songs.createdAt, startOfDay),
            lt(songs.createdAt, endOfDay)
          )
        )

      dailyUsed = dailyUsedResult[0]?.count || 0
    } else if (limitType === 'weekly' && effectiveLimit > 0) {
      const startOfWeek = new Date(now)
      const dayOfWeek = now.getDay()
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 周一为一周开始
      startOfWeek.setDate(now.getDate() - daysToSubtract)
      startOfWeek.setHours(0, 0, 0, 0)

      const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)

      const weeklyUsedResult = await db
        .select({ count: count() })
        .from(songs)
        .where(
          and(
            eq(songs.requesterId, user.id),
            gte(songs.createdAt, startOfWeek),
            lt(songs.createdAt, endOfWeek)
          )
        )

      weeklyUsed = weeklyUsedResult[0]?.count || 0
    }

    status.dailyLimit = limitType === 'daily' ? effectiveLimit : null
    status.weeklyLimit = limitType === 'weekly' ? effectiveLimit : null
    status.dailyUsed = dailyUsed
    status.weeklyUsed = weeklyUsed
    status.dailyRemaining =
      limitType === 'daily' && effectiveLimit ? Math.max(0, effectiveLimit - dailyUsed) : null
    status.weeklyRemaining =
      limitType === 'weekly' && effectiveLimit ? Math.max(0, effectiveLimit - weeklyUsed) : null

    return status
  } catch (error) {
    console.error('获取投稿状态失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取投稿状态失败'
    })
  }
})
