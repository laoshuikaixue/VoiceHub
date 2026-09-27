import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { resolveAvatarSource } from '~~/server/utils/user-avatar'
import { canReadUsers } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  // 权限：user.read（ADMIN 及以上）；未登录 401 / 账号异常 403 / 缺权限 403
  await canReadUsers(event)

  const userId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createError({
      statusCode: 400,
      message: '无效的用户ID'
    })
  }

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
      updatedAt: true,
      avatarProvider: true,
      avatarProviderUserId: true
    },
    with: {
      identities: {
        columns: {
          provider: true,
          providerUsername: true,
          providerUserId: true,
          avatar: true,
          createdAt: true
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

  const avatarSource = resolveAvatarSource(user, user.identities || [])
  return {
    ...user,
    avatar: avatarSource?.url ?? null
  }
})
