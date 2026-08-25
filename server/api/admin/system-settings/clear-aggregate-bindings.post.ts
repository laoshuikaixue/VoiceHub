import { db, users, userIdentities } from '~/drizzle/db'
import { eq, or, like, inArray } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { resolveAvatarSource } from '~~/server/utils/user-avatar'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED_ACCESS', '未授权访问')
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能清除聚合登录绑定'
    })
  }

  const result = await db.transaction(async (tx) => {
    // 1. 查询所有聚合登录相关的身份
    const targetIdentities = await tx.query.userIdentities.findMany({
      where: or(
        eq(userIdentities.provider, 'aggregate'),
        like(userIdentities.provider, 'aggregate:%')
      ),
      columns: {
        id: true,
        userId: true,
        provider: true,
        providerUserId: true
      }
    })

    if (targetIdentities.length === 0) {
      return { count: 0, usersAffected: 0 }
    }

    const affectedUserIds = Array.from(new Set(targetIdentities.map((item) => item.userId)))

    // 2. 检查受影响用户的头像来源
    const targetKeys = new Set(
      targetIdentities.map((identity) => `${identity.provider}:${identity.providerUserId}`)
    )

    const affectedUsers = await tx.query.users.findMany({
      where: inArray(users.id, affectedUserIds),
      columns: {
        id: true,
        avatarProvider: true,
        avatarProviderUserId: true
      }
    })

    const allIdentitiesForAffected = await tx.query.userIdentities.findMany({
      where: inArray(userIdentities.userId, affectedUserIds),
      columns: {
        id: true,
        userId: true,
        provider: true,
        providerUserId: true,
        providerUsername: true,
        avatar: true,
        createdAt: true
      }
    })

    // 按用户分组剩余身份
    const identitiesByUser = new Map<number, typeof allIdentitiesForAffected>()
    for (const identity of allIdentitiesForAffected) {
      if (!targetKeys.has(`${identity.provider}:${identity.providerUserId}`)) {
        if (!identitiesByUser.has(identity.userId)) {
          identitiesByUser.set(identity.userId, [])
        }
        identitiesByUser.get(identity.userId)!.push(identity)
      }
    }

    // 更新需要重置头像的用户
    for (const userRecord of affectedUsers) {
      const isAvatarSourceDeleted =
        userRecord.avatarProvider &&
        (userRecord.avatarProvider === 'aggregate' ||
          userRecord.avatarProvider.startsWith('aggregate:') ||
          targetKeys.has(`${userRecord.avatarProvider}:${userRecord.avatarProviderUserId}`))

      if (isAvatarSourceDeleted) {
        const remaining = identitiesByUser.get(userRecord.id) || []
        const fallback = resolveAvatarSource(userRecord, remaining)
        await tx
          .update(users)
          .set({
            avatarProvider: fallback?.provider ?? null,
            avatarProviderUserId: fallback?.providerUserId ?? null
          })
          .where(eq(users.id, userRecord.id))
      }
    }

    // 3. 批量删除所有聚合登录身份
    await tx
      .delete(userIdentities)
      .where(
        or(
          eq(userIdentities.provider, 'aggregate'),
          like(userIdentities.provider, 'aggregate:%')
        )
      )

    return {
      count: targetIdentities.length,
      usersAffected: affectedUserIds.length
    }
  })

  return {
    success: true,
    count: result.count,
    usersAffected: result.usersAffected
  }
})
