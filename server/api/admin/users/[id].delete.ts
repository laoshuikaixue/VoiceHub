import {createError, defineEventHandler, getRouterParam} from 'h3'
import {db} from '~/drizzle/db'
import {users} from '~/drizzle/schema'
import {eq} from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    try {
        // 检查认证和权限
        const user = event.context.user
        if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
            throw createError({
                statusCode: 403,
                statusMessage: '没有权限访问'
            })
        }

        const userId = getRouterParam(event, 'id')

        // 检查用户是否存在
        const existingUserResult = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1)
        const existingUser = existingUserResult[0]

        if (!existingUser) {
            throw createError({
                statusCode: 404,
                statusMessage: '用户不存在'
            })
        }

        // 防止删除自己
        if (existingUser.id === user.id) {
            throw createError({
                statusCode: 400,
                statusMessage: '不能删除自己的账户'
            })
        }

        // 删除用户
        await db.delete(users).where(eq(users.id, parseInt(userId)))

        // 清除相关缓存
        try {
            const {cache} = await import('~/server/utils/cache-helpers')
            await cache.deletePattern('songs:*')
            await cache.deletePattern('schedules:*')
            await cache.deletePattern('stats:*')
            // 清除该用户的认证缓存
            await cache.delete(`auth:user:${existingUser.id}`)
            console.log('[Cache] 歌曲、排期、统计和用户认证缓存已清除（用户删除）')
        } catch (cacheError) {
            console.warn('[Cache] 清除缓存失败:', cacheError)
        }

        return {
            success: true,
            message: '用户删除成功'
        }
    } catch (error) {
        console.error('删除用户失败:', error)

        if (error.statusCode) {
            throw error
        }

        throw createError({
            statusCode: 500,
            statusMessage: '删除用户失败: ' + error.message
        })
    }
})
