import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { resolveAvatarSource } from '~~/server/utils/user-avatar'

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
