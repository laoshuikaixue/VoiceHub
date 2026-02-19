import { db } from '~/drizzle/db'
import { CacheService } from '~~/server/services/cacheService'
import { users } from '~/drizzle/schema'
import { inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    // 验证请求方法
    if (event.node.req.method !== 'POST') {
      throw createError({
        statusCode: 405,
        statusMessage: 'Method Not Allowed'
      })
    }

    // 获取请求体
    const body = await readBody(event)
    const { userIds, targetGrade, keepClass } = body

    // 验证必填字段
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'userIds is required and must be a non-empty array'
      })
    }

    if (!targetGrade || typeof targetGrade !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'targetGrade is required and must be a string'
      })
    }

    if (typeof keepClass !== 'boolean') {
      throw createError({
        statusCode: 400,
        statusMessage: 'keepClass is required and must be a boolean'
      })
    }

    // 使用认证中间件提供的用户信息
    const currentUser = event.context.user

    if (!currentUser) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }

    // 检查权限 - 只有管理员和超级管理员可以执行批量更新
    if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Insufficient permissions'
      })
    }

    // 验证用户ID是否存在
    const existingUsers = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        grade: users.grade,
        class: users.class
      })
      .from(users)
      .where(inArray(users.id, userIds))

    const existingUserIds = existingUsers.map((user) => user.id)
    const nonExistentUserIds = userIds.filter((id) => !existingUserIds.includes(id))

    let updated = 0
    let failed = 0
    const errors: string[] = []

    // 记录不存在的用户ID
    if (nonExistentUserIds.length > 0) {
      failed += nonExistentUserIds.length
      errors.push(`用户ID ${nonExistentUserIds.join(', ')} 不存在`)
    }

    // 批量更新存在的用户
    if (existingUserIds.length > 0) {
      try {
        const updateData: any = {
          grade: targetGrade,
          updatedAt: new Date()
        }

        // 如果不保持班级不变，可以在这里添加班级更新逻辑
        // 当前实现中keepClass固定为true，所以不更新班级

        const updateResult = await db
          .update(users)
          .set(updateData)
          .where(inArray(users.id, existingUserIds))
          .returning({ id: users.id })

        updated = updateResult.length
      } catch (error) {
        console.error('批量更新失败:', error)
        failed += existingUserIds.length
        errors.push('批量更新操作失败')
      }
    }

    // 如果有用户更新成功，清除相关缓存
    if (updated > 0) {
      try {
        const cacheService = CacheService.getInstance()
        await cacheService.clearSongsCache()
        console.log('批量年级更新后缓存清除成功')
      } catch (cacheError) {
        console.error('批量年级更新后缓存清除失败:', cacheError)
      }
    }

    // 记录操作日志（可选，如果需要的话）
    try {
      // 这里可以添加操作日志记录
      // 由于不修改数据库结构，暂时跳过日志记录
    } catch (logError) {
      console.error('记录操作日志失败:', logError)
      // 日志记录失败不影响主要操作
    }

    return {
      success: errors.length === 0 || updated > 0,
      updated,
      failed,
      errors,
      details: {
        totalRequested: userIds.length,
        existingUsers: existingUsers.length,
        nonExistentUsers: nonExistentUserIds.length,
        targetGrade,
        keepClass
      }
    }
  } catch (error) {
    console.error('批量年级更新API错误:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error'
    })
  }
})
