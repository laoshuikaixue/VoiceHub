import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { users, userStatusLogs } from '~/drizzle/schema'
import { and, eq, inArray } from 'drizzle-orm'
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

    const body = await readBody(event)
    const { userIds, status, reason } = body

    // 验证必填字段
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: '用户ID列表不能为空'
      })
    }

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

    // 验证用户ID格式
    const validUserIds = userIds
      .filter((id) => {
        const numId = parseInt(id)
        return !isNaN(numId) && numId > 0
      })
      .map((id) => parseInt(id))

    if (validUserIds.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: '没有有效的用户ID'
      })
    }

    // 检查用户是否存在且为学生角色
    const existingUsers = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        status: users.status,
        role: users.role
      })
      .from(users)
      .where(and(inArray(users.id, validUserIds), eq(users.role, 'USER')))

    if (existingUsers.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: '没有找到可更新的学生用户'
      })
    }

    // 筛选出状态需要变更的用户
    const usersToUpdate = existingUsers.filter((u) => u.status !== status)

    if (usersToUpdate.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: '所选用户的状态均无需变更'
      })
    }

    const currentTime = getBeijingTime()
    const results = []

    // 开始事务
    await db.transaction(async (tx) => {
      for (const targetUser of usersToUpdate) {
        // 更新用户状态
        await tx
          .update(users)
          .set({
            status: status,
            statusChangedAt: currentTime,
            statusChangedBy: user.id
          })
          .where(eq(users.id, targetUser.id))

        // 记录状态变更日志
        await tx.insert(userStatusLogs).values({
          userId: targetUser.id,
          oldStatus: targetUser.status,
          newStatus: status,
          reason: reason.trim(),
          operatorId: user.id,
          createdAt: currentTime
        })

        results.push({
          userId: targetUser.id,
          name: targetUser.name,
          username: targetUser.username,
          oldStatus: targetUser.status,
          newStatus: status
        })
      }
    })

    // 清除相关缓存
    try {
      const { cache } = await import('~~/server/utils/cache-helpers')
      for (const userId of usersToUpdate.map((u) => u.id)) {
        await cache.delete(`auth:user:${userId}`)
      }
      console.log('[Cache] 批量用户认证缓存已清除（状态更新）')
    } catch (cacheError) {
      console.warn('[Cache] 清除缓存失败:', cacheError)
    }

    return {
      success: true,
      message: `成功更新 ${results.length} 个用户的状态为${status === 'active' ? '正常' : '退学'}`,
      data: {
        totalRequested: validUserIds.length,
        totalUpdated: results.length,
        updatedUsers: results,
        changedAt: currentTime,
        changedBy: user.name
      }
    }
  } catch (error) {
    console.error('批量更新用户状态失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: '批量更新用户状态失败: ' + error.message
    })
  }
})
