import {db} from '~/drizzle/db'
import {requestTimes} from '~/drizzle/schema'
import {and, gt, gte, ilike, lt, lte, or} from 'drizzle-orm'

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
            message: '只有管理员才能添加投稿开放时段'
        })
    }

    // 获取请求体
    const body = await readBody(event)

    // 验证必填字段
    if (!body.name) {
        throw createError({
            statusCode: 400,
            message: '时段名称不能为空'
        })
    }

    // 验证时间格式（如果提供了时间）
    // const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    // if (body.startTime && !timeRegex.test(body.startTime)) {
    //     throw createError({
    //         statusCode: 400,
    //         message: '开始时间格式不正确，应为HH:MM格式'
    //     })
    // }
    //
    // if (body.endTime && !timeRegex.test(body.endTime)) {
    //     throw createError({
    //         statusCode: 400,
    //         message: '结束时间格式不正确，应为HH:MM格式'
    //     })
    // }

    // 验证时间顺序（仅当两者都提供时）
    if (body.startTime && body.endTime && body.startTime >= body.endTime) {
        throw createError({
            statusCode: 400,
            message: '开始时间必须早于结束时间'
        })
    }

    try {
        // 检查名称是否已存在
        const existingRequestTimeResult = await db.select().from(requestTimes).where(ilike(requestTimes.name, body.name)).limit(1)
        const existingRequestTime = existingRequestTimeResult[0]

        if (existingRequestTime) {
            throw createError({
                statusCode: 400,
                message: '投稿开放时段名称已存在，请使用其他名称'
            })
        }

        // 时间冲突检查（仅当提供了时间时才检查）
        if (body.startTime || body.endTime) {
            const startTime = body.startTime ? new Date(body.startTime) : null
            const endTime = body.endTime ? new Date(body.endTime) : null
            
            let conflictConditions = []
            
            if (startTime && endTime) {
                // 如果提供了开始和结束时间，检查是否与现有时段重叠
                conflictConditions.push(
                    and(lte(requestTimes.startTime, endTime), gt(requestTimes.endTime, startTime))
                )
            } else if (startTime) {
                // 如果只提供了开始时间，检查是否与现有时段的结束时间冲突
                conflictConditions.push(
                    and(lte(requestTimes.startTime, startTime), gt(requestTimes.endTime, startTime))
                )
            } else if (endTime) {
                // 如果只提供了结束时间，检查是否与现有时段的开始时间冲突
                conflictConditions.push(
                    and(lte(requestTimes.startTime, endTime), gt(requestTimes.endTime, endTime))
                )
            }
            
            if (conflictConditions.length > 0) {
                const hitRequestTimeResult = await db.select().from(requestTimes).where(or(...conflictConditions)).limit(1)
                const hitRequestTime = hitRequestTimeResult[0]

                if (hitRequestTime) {
                    throw createError({
                        statusCode: 400,
                        message: '投稿开放时段时间冲突，请使用其他时间'
                    })
                }
            }
        }

        // 创建新的投稿开放时段
        const newRequestTimeResult = await db.insert(requestTimes).values({
            name: body.name,
            startTime: body.startTime ? new Date(body.startTime) : null,
            endTime: body.endTime ? new Date(body.endTime) : null,
            description: body.description || null,
            enabled: body.enabled !== undefined ? body.enabled : true,
            expected: body.expected || 0,
            accepted: body.accepted || 0,
        }).returning()
        const newRequestTime = newRequestTimeResult[0]

        // 清除相关缓存
        try {
            const {cache} = await import('~/server/utils/cache-helpers')
            await cache.deletePattern('schedules:*')
            await cache.deletePattern('requestTimes:*')
            console.log('[Cache] 排期和播放时间缓存已清除（创建播放时间）')
        } catch (cacheError) {
            console.warn('清除缓存失败:', cacheError)
        }

        return newRequestTime
    } catch (error: any) {
        console.error('创建投稿开放时段失败:', error)

        // 如果是我们自定义的错误，直接抛出
        if (error.statusCode) {
            throw error
        }

        throw createError({
            statusCode: 500,
            message: '创建投稿开放时段失败'
        })
    }
})