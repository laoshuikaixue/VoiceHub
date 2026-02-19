import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { users, userStatusLogs } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getBeijingTime } from '~/utils/timeUtils'

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
    const body = await readBody(event)
    const { status, reason } = body

    // 验证必填字段
    if (!status || !['active', 'withdrawn'].includes(status)) {
      throw createError({
        statusCode: 400,
        statusMessage: '状态必须为 active 或 withdrawn'
      })
    }

    if (!reason || reason.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: '变更原因为必填项'
      })
    }

    // 检查用户是否存在
    const existingUser = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        status: users.status,
        role: users.role
      })
      .from(users)
      .where(eq(users.id, parseInt(userId)))
      .limit(1)

    if (existingUser.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    const targetUser = existingUser[0]

    // 检查是否为学生用户
    if (targetUser.role !== 'USER') {
      throw createError({
        statusCode: 400,
        statusMessage: '只能修改学生用户的状态'
      })
    }

    // 检查状态是否有变化
    if (targetUser.status === status) {
      throw createError({
        statusCode: 400,
        statusMessage: '用户状态未发生变化'
      })
    }

    const currentTime = getBeijingTime()
    const oldStatus = targetUser.status

    // 开始事务
    await db.transaction(async (tx) => {
      // 更新用户状态
      await tx
        .update(users)
        .set({
          status: status,
          statusChangedAt: currentTime,
          statusChangedBy: user.id
        })
        .where(eq(users.id, parseInt(userId)))

      // 记录状态变更日志
      await tx.insert(userStatusLogs).values({
        userId: parseInt(userId),
        oldStatus: oldStatus,
        newStatus: status,
        reason: reason.trim(),
        operatorId: user.id,
        createdAt: currentTime
      })
    })

    // 清除相关缓存
    try {
      const { cache } = await import('~~/server/utils/cache-helpers')
      await cache.delete(`auth:user:${parseInt(userId)}`)
      console.log('[Cache] 用户认证缓存已清除（状态更新）')
    } catch (cacheError) {
      console.warn('[Cache] 清除缓存失败:', cacheError)
    }

    return {
      success: true,
      message: `用户状态已更新为${status === 'active' ? '正常' : '退学'}`,
      data: {
        userId: parseInt(userId),
        oldStatus,
        newStatus: status,
        changedAt: currentTime,
        changedBy: user.name
      }
    }
  } catch (error) {
    console.error('更新用户状态失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: '更新用户状态失败: ' + error.message
    })
  }
})
