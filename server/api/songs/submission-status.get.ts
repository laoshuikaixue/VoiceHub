import { db } from '~/drizzle/db'
import { requestTimes, songs, systemSettings } from '~/drizzle/schema'
import { and, count, eq, gt, gte, lt, lte } from 'drizzle-orm'
import {
  getBeijingEndOfDay,
  getBeijingEndOfWeek,
  getBeijingEndOfMonth,
  getBeijingStartOfDay,
  getBeijingStartOfWeek,
  getBeijingStartOfMonth,
  getBeijingTimeISOString
} from '~/utils/timeUtils'

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
      monthlyLimit: null,
      dailyUsed: 0,
      weeklyUsed: 0,
      monthlyUsed: 0,
      dailyRemaining: null,
      weeklyRemaining: null,
      monthlyRemaining: null,
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

    // 确定生效的限额类型（三选一逻辑）
    const dailyLimit = systemSettingsData.dailySubmissionLimit
    const weeklyLimit = systemSettingsData.weeklySubmissionLimit
    const monthlyLimit = systemSettingsData.monthlySubmissionLimit

    let effectiveLimit: number | null = null
    let limitType: 'daily' | 'weekly' | 'monthly' | null = null

    if (dailyLimit !== null && dailyLimit !== undefined) {
      effectiveLimit = dailyLimit
      limitType = 'daily'
    } else if (weeklyLimit !== null && weeklyLimit !== undefined) {
      effectiveLimit = weeklyLimit
      limitType = 'weekly'
    } else if (monthlyLimit !== null && monthlyLimit !== undefined) {
      effectiveLimit = monthlyLimit
      limitType = 'monthly'
    }

    // 检查是否设置了限额为0（关闭投稿）
    if (effectiveLimit === 0) {
      status.dailyLimit = limitType === 'daily' ? effectiveLimit : null
      status.weeklyLimit = limitType === 'weekly' ? effectiveLimit : null
      status.monthlyLimit = limitType === 'monthly' ? effectiveLimit : null
      status.dailyRemaining = 0
      status.weeklyRemaining = 0
      status.monthlyRemaining = 0
      status.submissionClosed = !isAdmin // 管理员不受投稿关闭限制
      return status
    }

    // 只计算生效的限额类型的使用量
    let dailyUsed = 0
    let weeklyUsed = 0
    let monthlyUsed = 0

    if (limitType === 'daily' && effectiveLimit && effectiveLimit > 0) {
      const startOfDay = getBeijingStartOfDay()
      const endOfDay = getBeijingEndOfDay()

      const dailyUsedResult = await db
        .select({ count: count() })
        .from(songs)
        .where(
          and(
            eq(songs.requesterId, user.id),
            gte(songs.createdAt, startOfDay),
            lte(songs.createdAt, endOfDay)
          )
        )

      dailyUsed = dailyUsedResult[0]?.count || 0
    } else if (limitType === 'weekly' && effectiveLimit && effectiveLimit > 0) {
      const startOfWeek = getBeijingStartOfWeek()
      const endOfWeek = getBeijingEndOfWeek()

      const weeklyUsedResult = await db
        .select({ count: count() })
        .from(songs)
        .where(
          and(
            eq(songs.requesterId, user.id),
            gte(songs.createdAt, startOfWeek),
            lte(songs.createdAt, endOfWeek)
          )
        )

      weeklyUsed = weeklyUsedResult[0]?.count || 0
    } else if (limitType === 'monthly' && effectiveLimit && effectiveLimit > 0) {
      const startOfMonth = getBeijingStartOfMonth()
      const endOfMonth = getBeijingEndOfMonth()

      const monthlyUsedResult = await db
        .select({ count: count() })
        .from(songs)
        .where(
          and(
            eq(songs.requesterId, user.id),
            gte(songs.createdAt, startOfMonth),
            lte(songs.createdAt, endOfMonth)
          )
        )

      monthlyUsed = monthlyUsedResult[0]?.count || 0
    }

    status.dailyLimit = limitType === 'daily' ? effectiveLimit : null
    status.weeklyLimit = limitType === 'weekly' ? effectiveLimit : null
    status.monthlyLimit = limitType === 'monthly' ? effectiveLimit : null
    status.dailyUsed = dailyUsed
    status.weeklyUsed = weeklyUsed
    status.monthlyUsed = monthlyUsed
    status.dailyRemaining =
      limitType === 'daily' && effectiveLimit ? Math.max(0, effectiveLimit - dailyUsed) : null
    status.weeklyRemaining =
      limitType === 'weekly' && effectiveLimit ? Math.max(0, effectiveLimit - weeklyUsed) : null
    status.monthlyRemaining =
      limitType === 'monthly' && effectiveLimit ? Math.max(0, effectiveLimit - monthlyUsed) : null

    return status
  } catch (error) {
    console.error('获取投稿状态失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取投稿状态失败'
    })
  }
})
