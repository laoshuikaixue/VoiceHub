import { createError, defineEventHandler, getMethod, getRouterParam, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { users, userStatusLogs } from '~/drizzle/schema'
import { updateUserPassword } from '~~/server/services/userService'

export default defineEventHandler(async (event) => {
  const currentUser = event.context.user
  if (!currentUser || !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }

  const userId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createError({
      statusCode: 400,
      message: '无效的用户ID'
    })
  }

  const method = getMethod(event)

  if (method === 'GET') {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        name: true,
        username: true,
        role: true,
        grade: true,
        class: true,
        status: true,
        statusChangedAt: true,
        lastLogin: true,
        lastLoginIp: true,
        passwordChangedAt: true,
        forcePasswordChange: true,
        meowNickname: true,
        meowBoundAt: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true
      },
      with: {
        identities: {
          columns: {
            provider: true,
            providerUsername: true,
            providerUserId: true
          }
        }
      }
    })

    if (!user) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    const githubIdentity = user.identities?.find((identity) => identity.provider === 'github')
    return {
      ...user,
      avatar: githubIdentity?.providerUsername
        ? `https://github.com/${githubIdentity.providerUsername}.png`
        : null
    }
  }

  if (method === 'PUT') {
    const body = await readBody(event)

    if (!body || !body.name) {
      throw createError({
        statusCode: 400,
        message: '姓名不能为空'
      })
    }

    const existingUserResult = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (existingUserResult.length === 0) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    const targetUser = existingUserResult[0]

    if (targetUser.id === 1) {
      throw createError({
        statusCode: 403,
        message: '无法修改系统初始超级管理员'
      })
    }

    if (String(userId) === String(currentUser.id)) {
      throw createError({
        statusCode: 400,
        message: '禁止在用户管理中修改自己的账户'
      })
    }

    if (targetUser.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
      throw createError({
        statusCode: 403,
        message: '权限不足：普通管理员无法修改超级管理员信息'
      })
    }

    const username = body.username || targetUser.username
    if (username !== targetUser.username) {
      const duplicateUser = await db.select().from(users).where(eq(users.username, username)).limit(1)
      if (duplicateUser.length > 0) {
        throw createError({
          statusCode: 400,
          message: '用户名已被其他用户使用'
        })
      }
    }

    let validRole = targetUser.role
    if (body.role) {
      if (!['USER', 'ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN'].includes(body.role)) {
        throw createError({
          statusCode: 400,
          message: '无效的用户角色'
        })
      }

      if (currentUser.role === 'SUPER_ADMIN') {
        validRole = body.role
      } else if (currentUser.role === 'ADMIN' && ['USER', 'SONG_ADMIN'].includes(body.role)) {
        validRole = body.role
      } else {
        throw createError({
          statusCode: 403,
          message: '管理员只能设置用户和歌曲管理员角色'
        })
      }
    }

    if (body.status && !['active', 'withdrawn', 'graduate'].includes(body.status)) {
      throw createError({
        statusCode: 400,
        message: '用户状态只能是 active, withdrawn 或 graduate'
      })
    }

    const updateData = {
      name: body.name,
      username,
      role: validRole,
      grade: body.grade,
      class: body.class,
      ...(body.status && body.status !== targetUser.status
        ? {
            status: body.status,
            statusChangedAt: new Date(),
            statusChangedBy: currentUser.id
          }
        : {})
    }

    if (body.password) {
      const trimmedPassword = String(body.password).trim()
      if (trimmedPassword.length < 6) {
        throw createError({
          statusCode: 400,
          message: '密码长度不能少于 6 位'
        })
      }

      await updateUserPassword(userId, trimmedPassword, true)
    }

    const updatedUserResult = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
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

    if (body.status && body.status !== targetUser.status) {
      await db.insert(userStatusLogs).values({
        userId,
        oldStatus: targetUser.status,
        newStatus: body.status,
        reason: `管理员${currentUser.name || currentUser.username}修改用户状态`,
        operatorId: currentUser.id
      })
    }

    try {
      const { cache, userCache } = await import('~~/server/utils/cache-helpers')
      await cache.deletePattern('song:*')
      await userCache.clearAuth(String(userId))
    } catch (cacheError) {
      console.warn('[Cache] 清除缓存失败:', cacheError)
    }

    return {
      success: true,
      user: updatedUserResult[0],
      message: '用户更新成功'
    }
  }

  if (method === 'DELETE') {
    const existingUserResult = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (existingUserResult.length === 0) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    const targetUser = existingUserResult[0]

    if (targetUser.id === 1) {
      throw createError({
        statusCode: 403,
        message: '无法删除系统初始超级管理员'
      })
    }

    if (String(targetUser.id) === String(currentUser.id)) {
      throw createError({
        statusCode: 400,
        message: '不能删除当前登录的用户'
      })
    }

    if (targetUser.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
      throw createError({
        statusCode: 403,
        message: '权限不足：普通管理员无法删除超级管理员'
      })
    }

    await db.delete(users).where(eq(users.id, userId))

    try {
      const { cache, userCache } = await import('~~/server/utils/cache-helpers')
      await cache.deletePattern('song:*')
      await cache.deletePattern('schedules:*')
      await cache.deletePattern('stats:*')
      await userCache.clearAuth(String(targetUser.id))
    } catch (cacheError) {
      console.warn('[Cache] 清除缓存失败:', cacheError)
    }

    return { success: true, message: '用户删除成功' }
  }

  throw createError({
    statusCode: 405,
    message: '不支持的请求方法'
  })
})
