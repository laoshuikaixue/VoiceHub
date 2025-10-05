import {db} from '~/drizzle/db'
import {songs, systemSettings} from '~/drizzle/schema'
import {and, count, eq, gte, lt} from 'drizzle-orm'

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

        if (!systemSettingsData?.enableSubmissionLimit) {
            return {
                limitEnabled: false,
                dailyLimit: null,
                weeklyLimit: null,
                dailyUsed: 0,
                weeklyUsed: 0,
                dailyRemaining: null,
                weeklyRemaining: null,
                submissionClosed: false
            }
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
            return {
                limitEnabled: true,
                dailyLimit: limitType === 'daily' ? effectiveLimit : null,
                weeklyLimit: limitType === 'weekly' ? effectiveLimit : null,
                dailyUsed: 0,
                weeklyUsed: 0,
                dailyRemaining: 0,
                weeklyRemaining: 0,
                submissionClosed: !isAdmin // 管理员不受投稿关闭限制
            }
        }

        const now = new Date()

        // 只计算生效的限额类型的使用量
        let dailyUsed = 0
        let weeklyUsed = 0

        if (limitType === 'daily' && effectiveLimit > 0) {
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

            const dailyUsedResult = await db.select({count: count()}).from(songs)
                .where(and(
                    eq(songs.requesterId, user.id),
                    gte(songs.createdAt, startOfDay),
                    lt(songs.createdAt, endOfDay)
                ))

            dailyUsed = dailyUsedResult[0]?.count || 0
        } else if (limitType === 'weekly' && effectiveLimit > 0) {
            const startOfWeek = new Date(now)
            const dayOfWeek = now.getDay()
            const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 周一为一周开始
            startOfWeek.setDate(now.getDate() - daysToSubtract)
            startOfWeek.setHours(0, 0, 0, 0)

            const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)

            const weeklyUsedResult = await db.select({count: count()}).from(songs)
                .where(and(
                    eq(songs.requesterId, user.id),
                    gte(songs.createdAt, startOfWeek),
                    lt(songs.createdAt, endOfWeek)
                ))

            weeklyUsed = weeklyUsedResult[0]?.count || 0
        }

        return {
            limitEnabled: true,
            dailyLimit: limitType === 'daily' ? effectiveLimit : null,
            weeklyLimit: limitType === 'weekly' ? effectiveLimit : null,
            dailyUsed,
            weeklyUsed,
            dailyRemaining: limitType === 'daily' && effectiveLimit ? Math.max(0, effectiveLimit - dailyUsed) : null,
            weeklyRemaining: limitType === 'weekly' && effectiveLimit ? Math.max(0, effectiveLimit - weeklyUsed) : null,
            submissionClosed: false
        }
    } catch (error) {
        console.error('获取投稿状态失败:', error)
        throw createError({
            statusCode: 500,
            message: '获取投稿状态失败'
        })
    }
})