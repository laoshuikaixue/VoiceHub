import { createError, defineEventHandler, getRouterParam } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

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
    const existingUserResult = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(userId)))
      .limit(1)
    const existingUser = existingUserResult[0]

    if (!existingUser) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    // 1. 绝对禁止删除 ID 为 1 的用户 (系统初始超级管理员)
    if (existingUser.id === 1) {
      throw createError({
        statusCode: 403,
        statusMessage: '无法删除系统初始超级管理员'
      })
    }

    // 2. 禁止删除自己 (增强类型安全)
    // 使用 String 转换确保 ID 比较的准确性
    if (String(existingUser.id) === String(user.id)) {
      throw createError({
        statusCode: 400,
        statusMessage: '不能删除自己的账户'
      })
    }

    // 3. 越级删除保护
    // 如果目标用户是 SUPER_ADMIN，操作者必须是 SUPER_ADMIN
    if (existingUser.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw createError({
        statusCode: 403,
        statusMessage: '权限不足：普通管理员无法删除超级管理员'
      })
    }

    // 删除用户
    await db.delete(users).where(eq(users.id, parseInt(userId)))

    // 清除相关缓存
    try {
      const { cache } = await import('~~/server/utils/cache-helpers')
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
