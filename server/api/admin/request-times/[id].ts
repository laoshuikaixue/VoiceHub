import {db} from '~/drizzle/db'
import {CacheService} from '../../../services/cacheService'
import {requestTimes, schedules, songs} from '~/drizzle/schema'
import {and, count, eq, ne} from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    // 检查用户认证和权限
    const user = event.context.user

    if (!user) {
        throw createError({
            statusCode: 401,
            message: '未授权访问'
        })
    }

    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        throw createError({
            statusCode: 403,
            message: '只有管理员才能访问投稿开放时段'
        })
    }

    // 获取投稿开放时段ID
    const id = parseInt(event.context.params?.id || '0')

    if (!id) {
        throw createError({
            statusCode: 400,
            message: '投稿开放时段ID不正确'
        })
    }

    // 根据请求方法执行不同操作
    const method = event.method

    if (method === 'GET') {
        try {
            // 获取指定投稿开放时段
            const requestTimeResult = await db.select().from(requestTimes).where(eq(requestTimes.id, id)).limit(1)
            const requestTime = requestTimeResult[0]

            if (!requestTime) {
                throw createError({
                    statusCode: 404,
                    message: '找不到指定的投稿开放时段'
                })
            }

            return requestTime
        } catch (error) {
            console.error('获取投稿开放时段失败:', error)
            throw createError({
                statusCode: 500,
                message: '获取投稿开放时段失败'
            })
        }
    } else if (method === 'PUT') {
        // 更新投稿开放时段
        const body = await readBody(event)

        // 验证必填字段
        if (!body.name) {
            throw createError({
                statusCode: 400,
                message: '时段名称不能为空'
            })
        }

        // 验证时间顺序（仅当两者都提供时）
        if (body.startTime && body.endTime && body.startTime >= body.endTime) {
            throw createError({
                statusCode: 400,
                message: '开始时间必须早于结束时间'
            })
        }

        try {
            // 检查名称是否已存在（排除当前ID）
            const existingRequestTimeResult = await db.select().from(requestTimes)
                .where(and(
                    eq(requestTimes.name, body.name),
                    ne(requestTimes.id, id)
                )).limit(1)
            const existingRequestTime = existingRequestTimeResult[0]

            if (existingRequestTime) {
                throw createError({
                    statusCode: 400,
                    message: '投稿开放时段名称已存在，请使用其他名称'
                })
            }

            // 更新投稿开放时段
            const updatedRequestTimeResult = await db.update(requestTimes)
                .set({
                    name: body.name,
                    startTime: body.startTime ? new Date(body.startTime) : null,
                    endTime: body.endTime ? new Date(body.endTime) : null,
                    description: body.description ?? null,
                    enabled: body.enabled !== undefined ? body.enabled : true,
                    expected: body.expected ?? null,
                })
                .where(eq(requestTimes.id, id))
                .returning()
            const updatedRequestTime = updatedRequestTimeResult[0]

            // 清除相关缓存
            try {
                const cacheService = CacheService.getInstance()
                await cacheService.clearSchedulesCache()
                //await cacheService.clearRequestTimesCache()
                console.log('[Cache] 排期缓存已清除（播放时间更新）')
            } catch (cacheError) {
                console.warn('[Cache] 清除缓存失败:', cacheError)
            }

            return updatedRequestTime
        } catch (error: any) {
            console.error('更新投稿开放时段失败:', error)

            // 如果是我们自定义的错误，直接抛出
            if (error.statusCode) {
                throw error
            }

            throw createError({
                statusCode: 500,
                message: '更新投稿开放时段失败'
            })
        }
    } else if (method === 'PATCH') {
        // 部分更新（主要用于启用/禁用）
        const body = await readBody(event)

        try {
            // 如果要更新名称，先检查是否存在重名
            if (body.name !== undefined) {
                // 检查名称是否已存在（排除当前ID）
                const existingRequestTimeResult = await db.select().from(requestTimes)
                    .where(and(
                        eq(requestTimes.name, body.name),
                        ne(requestTimes.id, id)
                    )).limit(1)
                const existingRequestTime = existingRequestTimeResult[0]

                if (existingRequestTime) {
                    throw createError({
                        statusCode: 400,
                        message: '投稿开放时段名称已存在，请使用其他名称'
                    })
                }
            }

            // 更新投稿开放时段
            const updateData: any = {}
            if (body.name !== undefined) updateData.name = body.name
            if (body.startTime !== undefined) updateData.startTime = body.startTime
            if (body.endTime !== undefined) updateData.endTime = body.endTime
            if (body.description !== undefined) updateData.description = body.description
            if (body.enabled !== undefined) updateData.enabled = body.enabled
            if (body.expected !== undefined) updateData.expected = body.expected || 0

            const updatedRequestTimeResult = await db.update(requestTimes)
                .set(updateData)
                .where(eq(requestTimes.id, id))
                .returning()
            const updatedRequestTime = updatedRequestTimeResult[0]

            // 清除相关缓存
            try {
                const cacheService = CacheService.getInstance()
                await cacheService.clearSchedulesCache()
                //await cacheService.clearRequestTimesCache()
                console.log('[Cache] 排期缓存已清除（播放时间部分更新）')
            } catch (cacheError) {
                console.warn('[Cache] 清除缓存失败:', cacheError)
            }

            return updatedRequestTime
        } catch (error: any) {
            console.error('部分更新投稿开放时段失败:', error)

            // 如果是我们自定义的错误，直接抛出
            if (error.statusCode) {
                throw error
            }

            throw createError({
                statusCode: 500,
                message: '部分更新投稿开放时段失败'
            })
        }
    } else if (method === 'DELETE') {
        try {

            // 删除该投稿开放时段
            const deletedRequestTimeResult = await db.delete(requestTimes)
                .where(eq(requestTimes.id, id))
                .returning()
            const deletedRequestTime = deletedRequestTimeResult[0]

            // 清除相关缓存
            try {
                const cacheService = CacheService.getInstance()
                await cacheService.clearSchedulesCache()
                // There is no cache will be used
                // await cacheService.clearRequestTimesCache()
                console.log('[Cache] 缓存已清除（播放时间删除）')
            } catch (cacheError) {
                console.warn('[Cache] 清除缓存失败:', cacheError)
            }

            return {
                message: '投稿开放时段已成功删除',
            }
        } catch (error) {
            console.error('删除投稿开放时段失败:', error)
            throw createError({
                statusCode: 500,
                message: '删除投稿开放时段失败'
            })
        }
    } else {
        throw createError({
            statusCode: 405,
            message: '不支持的请求方法'
        })
    }
})