import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { users, userStatusLogs } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { updateUserPassword } from '~~/server/services/userService'

const normalizeRequiredText = (value: unknown) => String(value || '').trim()
const normalizeOptionalText = (value: unknown) => {
  const normalized = String(value || '').trim()
  return normalized || null
}

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

    const userId = getRouterParam(event, 'id')
    const body = await readBody(event)
    const { name, username, password, role, grade, class: userClass, status } = body || {}
    const normalizedName = normalizeRequiredText(name)
    const normalizedUsername = normalizeRequiredText(username)

    // 验证必填字段
    if (!normalizedName || !normalizedUsername) {
      throw createError({
        statusCode: 400,
        message: '姓名和用户名为必填项'
      })
    }

    // 检查用户是否存在
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(userId)))
      .limit(1)

    if (existingUser.length === 0) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    const targetUser = existingUser[0]

    // 1. 禁止修改系统初始超级管理员 (ID: 1)
    if (targetUser.id === 1) {
      throw createError({
        statusCode: 403,
        message: '无法修改系统初始超级管理员'
      })
    }

    // 2. 禁止对自身进行任何用户管理操作（包括角色、资料、状态、密码等）
    // 使用 String 转换确保 ID 比较的准确性
    if (String(userId) === String(user.id)) {
      throw createError({
        statusCode: 400,
        message: '禁止在用户管理中修改自己的账户'
      })
    }

    // 3. 越级修改保护
    // 如果目标用户是 SUPER_ADMIN，操作者必须是 SUPER_ADMIN
    if (targetUser.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw createError({
        statusCode: 403,
        message: '权限不足：普通管理员无法修改超级管理员信息'
      })
    }

    // 检查用户名是否被其他用户使用
    if (normalizedUsername !== targetUser.username) {
      const duplicateUser = await db
        .select()
        .from(users)
        .where(eq(users.username, normalizedUsername))
        .limit(1)

      if (duplicateUser.length > 0) {
        throw createError({
          statusCode: 400,
          message: '用户名已被其他用户使用'
        })
      }
    }

    // 角色权限控制
    let validRole = targetUser.role
    if (role) {
      if (!['USER', 'ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN'].includes(role)) {
        throw createError({
          statusCode: 400,
          message: '无效的用户角色'
        })
      }
    }

    if (role && role !== targetUser.role) {
      // 超级管理员可以设置任何角色
      if (user.role === 'SUPER_ADMIN') {
        validRole = role
      }
      // 管理员只能设置管理员以下的角色（USER, SONG_ADMIN）
      else if (user.role === 'ADMIN') {
        if (['USER', 'SONG_ADMIN'].includes(role)) {
          validRole = role
        } else {
          throw createError({
            statusCode: 403,
            message: '管理员只能设置用户和歌曲管理员角色'
          })
        }
      }
      // 其他角色不能设置角色
      else {
        throw createError({
          statusCode: 403,
          message: '没有权限设置用户角色'
        })
      }
    }

    // 验证status字段的有效性
    if (status && !['active', 'withdrawn', 'graduate'].includes(status)) {
      throw createError({
        statusCode: 400,
        message: '用户状态只能是 active, withdrawn 或 graduate'
      })
    }

    // 准备更新数据
    const updateData = {
      name: normalizedName,
      username: normalizedUsername,
      role: validRole,
      grade: normalizeOptionalText(grade),
      class: normalizeOptionalText(userClass),
      ...(status && status !== existingUser[0].status
        ? {
            status,
            statusChangedAt: new Date(),
            statusChangedBy: user.id
          }
        : {})
    }

    // 如果提供了密码，则使用统一服务更新密码
    if (password) {
      const trimmedPassword = String(password).trim()
      if (trimmedPassword.length < 6) {
        throw createError({
          statusCode: 400,
          message: '密码长度不能少于 6 位'
        })
      }

      await updateUserPassword(targetUser.id, trimmedPassword, true)
    }

    // 更新用户其他信息
    const updatedUser = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, parseInt(userId)))
      .returning({
        id: users.id,
        name: users.name,
        username: users.username,
        role: users.role,
        grade: users.grade,
        class: users.class,
        status: users.status,
        statusChangedAt: users.statusChangedAt,
        statusChangedBy: users.statusChangedBy,
        lastLogin: users.lastLogin,
        lastLoginIp: users.lastLoginIp,
        passwordChangedAt: users.passwordChangedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      })

    // 如果状态发生变更，记录到状态变更日志
    if (status && status !== existingUser[0].status) {
      await db.insert(userStatusLogs).values({
        userId: targetUser.id,
        oldStatus: existingUser[0].status,
        newStatus: status,
        reason: `管理员${user.name || user.username}修改用户状态`,
        operatorId: user.id
      })
    }

    // 清除相关缓存
    try {
      const { cache, userCache } = await import('~~/server/utils/cache-helpers')
      await cache.deletePattern('song:*')
      await userCache.clearAuth(String(userId))
      console.log('[Cache] 歌曲和用户认证缓存已清除（用户更新）')
    } catch (cacheError) {
      console.warn('[Cache] 清除缓存失败:', cacheError)
    }

    return {
      success: true,
      user: updatedUser[0],
      message: '用户更新成功'
    }
  } catch (error) {
    console.error('更新用户失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: '更新用户失败: ' + error.message
    })
  }
})
