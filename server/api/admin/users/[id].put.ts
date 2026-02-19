import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { users, userStatusLogs } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'

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
    const { name, username, password, role, grade, class: userClass, status } = body

    // 验证必填字段
    if (!name || !username) {
      throw createError({
        statusCode: 400,
        statusMessage: '姓名和用户名为必填项'
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
        statusMessage: '用户不存在'
      })
    }

    const targetUser = existingUser[0]

    // 1. 禁止修改系统初始超级管理员 (ID: 1)
    if (targetUser.id === 1) {
      throw createError({
        statusCode: 403,
        statusMessage: '无法修改系统初始超级管理员'
      })
    }

    // 2. 禁止对自身进行任何用户管理操作（包括角色、资料、状态、密码等）
    // 使用 String 转换确保 ID 比较的准确性
    if (String(userId) === String(user.id)) {
      throw createError({
        statusCode: 400,
        statusMessage: '禁止在用户管理中修改自己的账户'
      })
    }

    // 3. 越级修改保护
    // 如果目标用户是 SUPER_ADMIN，操作者必须是 SUPER_ADMIN
    if (targetUser.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw createError({
        statusCode: 403,
        statusMessage: '权限不足：普通管理员无法修改超级管理员信息'
      })
    }

    // 检查用户名是否被其他用户使用
    if (username !== targetUser.username) {
      const duplicateUser = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1)

      if (duplicateUser.length > 0) {
        throw createError({
          statusCode: 400,
          statusMessage: '用户名已被其他用户使用'
        })
      }
    }

    // 角色权限控制
    let validRole = 'USER'
    if (role && ['USER', 'ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN'].includes(role)) {
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
            statusMessage: '管理员只能设置用户和歌曲管理员角色'
          })
        }
      }
      // 其他角色不能设置角色
      else {
        throw createError({
          statusCode: 403,
          statusMessage: '没有权限设置用户角色'
        })
      }
    }

    // 验证status字段的有效性
    if (status && !['active', 'withdrawn'].includes(status)) {
      throw createError({
        statusCode: 400,
        statusMessage: '用户状态只能是active或withdrawn'
      })
    }

    // 准备更新数据
    const updateData = {
      name,
      username,
      role: validRole,
      grade,
      class: userClass
    }

    // 如果提供了status，则更新状态相关字段
    if (status && status !== existingUser[0].status) {
      updateData.status = status
      updateData.statusChangedAt = new Date()
      updateData.statusChangedBy = user.id
    }

    // 如果提供了密码，则加密并更新
    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    // 更新用户
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
        userId: parseInt(userId),
        oldStatus: existingUser[0].status,
        newStatus: status,
        reason: `管理员${user.name || user.username}修改用户状态`,
        operatorId: user.id
      })
    }

    // 清除相关缓存
    try {
      const { cache } = await import('~~/server/utils/cache-helpers')
      await cache.deletePattern('songs:*')
      // 清除该用户的认证缓存（角色或权限可能已变更）
      await cache.delete(`auth:user:${parseInt(userId)}`)
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
      statusMessage: '更新用户失败: ' + error.message
    })
  }
})
