import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { users, userStatusLogs } from '~/drizzle/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { getBeijingTime } from '~/utils/timeUtils'
import { getStatusText } from '~~/server/utils/user'

export default defineEventHandler(async (event) => {
  try {
    // 检查认证和权限
    const user = event.context.user
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        message: '没有权限访问'
      })
    }

    const body = await readBody(event)
    const { userIds, status, reason } = body

    // 验证必填字段
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw createError({
        statusCode: 400,
        message: '用户ID列表不能为空'
      })
    }

    if (!status || !['active', 'withdrawn', 'graduate'].includes(status)) {
      throw createError({
        statusCode: 400,
        message: '状态必须为 active, withdrawn 或 graduate'
      })
    }

    if (!reason || reason.trim().length === 0) {
      throw createError({
        statusCode: 400,
        message: '变更原因为必填项'
      })
    }

    // 验证用户ID格式
    const validUserIds = [...new Set(userIds
      .filter((id) => {
        const numId = parseInt(id)
        return !isNaN(numId) && numId > 0
      })
      .map((id) => parseInt(id)))]

    if (validUserIds.length === 0) {
      throw createError({
        statusCode: 400,
        message: '没有有效的用户ID'
      })
    }

    // 检查用户是否存在
    const existingUsers = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        status: users.status,
        role: users.role
      })
      .from(users)
      .where(inArray(users.id, validUserIds))

    const existingUserIds = existingUsers.map(u => u.id)
    const nonExistentUserIds = validUserIds.filter(id => !existingUserIds.includes(id))

    // 筛选出状态需要变更的用户，并加入越权保护，同时记录失败原因
    const usersToUpdate = []
    const errors: Array<{ userId: number | string; error: string }> = []

    if (nonExistentUserIds.length > 0) {
      nonExistentUserIds.forEach(id => {
        errors.push({ userId: id, error: '用户不存在' })
      })
    }

    for (const u of existingUsers) {
      if (u.id === 1) {
        errors.push({ userId: u.id, error: '无法修改系统初始超级管理员' })
        continue
      }
      if (u.id === user.id) {
        errors.push({ userId: u.id, error: '禁止在用户管理中批量更新自己的账户' })
        continue
      }
      if (u.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
        errors.push({ userId: u.id, error: '权限不足：普通管理员无法修改超级管理员信息' })
        continue
      }
      if (u.status === status) {
        errors.push({ userId: u.id, error: '用户状态无需变更' })
        continue
      }
      usersToUpdate.push(u)
    }

    if (usersToUpdate.length === 0) {
      return {
        success: false,
        message: '没有可更新的合法用户',
        errors,
        data: {
          totalRequested: validUserIds.length,
          totalUpdated: 0,
          updatedUsers: [],
        }
      }
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
      message: `成功更新 ${results.length} 个用户的状态为${getStatusText(status)}`,
      errors,
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
      message: '批量更新用户状态失败: ' + error.message
    })
  }
})
