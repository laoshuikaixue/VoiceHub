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
        message: 'Method Not Allowed'
      })
    }

    // 获取请求体
    const body = await readBody(event)
    const { userIds, targetGrade, keepClass } = body

    // 验证必填字段
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'userIds is required and must be a non-empty array'
      })
    }

    // 对输入的 userIds 进行去重和类型转换
    const uniqueUserIds = [...new Set(userIds.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0))]

    if (uniqueUserIds.length === 0) {
      throw createError({
        statusCode: 400,
        message: '没有有效的用户ID'
      })
    }

    if (!targetGrade || typeof targetGrade !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'targetGrade is required and must be a string'
      })
    }

    if (typeof keepClass !== 'boolean') {
      throw createError({
        statusCode: 400,
        message: 'keepClass is required and must be a boolean'
      })
    }

    // 使用认证中间件提供的用户信息
    const currentUser = event.context.user

    if (!currentUser) {
      throw createError({
        statusCode: 401,
        message: 'Authentication required'
      })
    }

    // 检查权限 - 只有管理员和超级管理员可以执行批量更新
    if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw createError({
        statusCode: 403,
        message: 'Insufficient permissions'
      })
    }

    // 验证用户ID是否存在
    const existingUsers = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        grade: users.grade,
        class: users.class,
        role: users.role
      })
      .from(users)
      .where(inArray(users.id, uniqueUserIds))

    const existingUserIds = existingUsers.map((user) => user.id)
    const nonExistentUserIds = uniqueUserIds.filter((id) => !existingUserIds.includes(id))

    let updated = 0
    let failed = 0
    const errors: Array<{ userId: number | string; error: string }> = []

    // 记录不存在的用户ID
    if (nonExistentUserIds.length > 0) {
      failed += nonExistentUserIds.length
      nonExistentUserIds.forEach(id => {
        errors.push({ userId: id, error: '用户不存在' })
      })
    }

    // 过滤出有权限修改的用户
    const validExistingUserIds: number[] = []
    for (const user of existingUsers) {
      if (user.id === 1) {
        failed++
        errors.push({ userId: user.id, error: '无法修改系统初始超级管理员' })
        continue
      }
      if (user.id === currentUser.id) {
        failed++
        errors.push({ userId: user.id, error: '禁止在用户管理中批量更新自己的账户' })
        continue
      }
      if (user.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
        failed++
        errors.push({ userId: user.id, error: '权限不足：普通管理员无法修改超级管理员信息' })
        continue
      }
      validExistingUserIds.push(user.id)
    }

    // 批量更新存在的用户
    if (validExistingUserIds.length > 0) {
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
          .where(inArray(users.id, validExistingUserIds))
          .returning({ id: users.id })

        updated = updateResult.length
      } catch (error) {
        console.error('批量更新失败:', error)
        failed += validExistingUserIds.length
        validExistingUserIds.forEach(id => {
          errors.push({ userId: id, error: '批量更新操作失败' })
        })
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
        totalRequested: uniqueUserIds.length,
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
      message: 'Internal Server Error'
    })
  }
})
