import {createError, defineEventHandler, getQuery} from 'h3'
import {db} from '~/drizzle/db'
import {notifications} from '~/drizzle/schema'
import {and, count, desc, eq} from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    // 检查用户认证
    const user = event.context.user

    if (!user) {
        throw createError({
            statusCode: 401,
            message: '需要登录才能获取通知'
        })
    }

    try {
        // 获取查询参数
        const query = getQuery(event)
        const page = Math.max(1, parseInt(query.page as string) || 1)
        const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 10))
        const offset = (page - 1) * limit

        // 获取总通知数量
        const totalCountResult = await db.select({count: count()}).from(notifications)
            .where(eq(notifications.userId, user.id))
        const totalCount = totalCountResult[0]?.count || 0
        const totalPages = Math.ceil(totalCount / limit)

        // 获取分页通知数据
        const userNotifications = await db.select().from(notifications)
            .where(eq(notifications.userId, user.id))
            .orderBy(desc(notifications.createdAt))
            .limit(limit)
            .offset(offset)

        // 计算未读通知数量
        const unreadCountResult = await db.select({count: count()}).from(notifications)
            .where(and(
                eq(notifications.userId, user.id),
                eq(notifications.read, false)
            ))

        const unreadCount = unreadCountResult[0]?.count || 0

        return {
            notifications: userNotifications,
            unreadCount,
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
                limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        }
    } catch (err) {
        console.error('获取通知失败:', err)
        throw createError({
            statusCode: 500,
            message: '获取通知失败'
        })
    }
})