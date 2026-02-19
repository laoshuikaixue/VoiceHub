import { db } from '~/drizzle/db'
import { requestTimes } from '~/drizzle/schema'
import { and, gt, gte, ilike, lt, lte, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
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

  const body = await readBody(event)

  if (!body.name) {
    throw createError({
      statusCode: 400,
      message: '时段名称不能为空'
    })
  }

  if (body.startTime && body.endTime && body.startTime >= body.endTime) {
    throw createError({
      statusCode: 400,
      message: '开始时间必须早于结束时间'
    })
  }

  try {
    const existingRequestTimeResult = await db
      .select()
      .from(requestTimes)
      .where(ilike(requestTimes.name, body.name))
      .limit(1)
    const existingRequestTime = existingRequestTimeResult[0]

    if (existingRequestTime) {
      throw createError({
        statusCode: 400,
        message: '投稿开放时段名称已存在，请使用其他名称'
      })
    }

    const hitRequestTimeResult = await db
      .select()
      .from(requestTimes)
      .where(
        or(
          and(lte(requestTimes.startTime, body.endTime), gt(requestTimes.endTime, body.endTime)),
          and(lte(requestTimes.startTime, body.startTime), gt(requestTimes.endTime, body.startTime))
        )
      )
      .limit(1)
    const hitRequestTime = hitRequestTimeResult[0]

    if (hitRequestTime) {
      throw createError({
        statusCode: 400,
        message: '投稿开放时段时间冲突，请使用其他时间'
      })
    }

    const newRequestTimeResult = await db
      .insert(requestTimes)
      .values({
        name: body.name,
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        description: body.description || null,
        enabled: body.enabled !== undefined ? body.enabled : true,
        expected: body.expected || 0,
        accepted: body.accepted || 0
      })
      .returning()
    const newRequestTime = newRequestTimeResult[0]

    try {
      const { cache } = await import('~~/server/utils/cache-helpers')
      await cache.deletePattern('schedules:*')
      await cache.deletePattern('requestTimes:*')
      console.log('[Cache] 排期和播放时间缓存已清除（创建播放时间）')
    } catch (cacheError) {
      console.warn('清除缓存失败:', cacheError)
    }

    return newRequestTime
  } catch (error: any) {
    console.error('创建投稿开放时段失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: '创建投稿开放时段失败'
    })
  }
})
