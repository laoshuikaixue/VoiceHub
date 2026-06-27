import { apiKeyPermissions, apiKeys, db } from '~/drizzle/db'
import { and, desc, eq } from 'drizzle-orm'
import { getBeijingTime } from '~/utils/timeUtils'

const PERSONAL_PERMISSION = 'songs:request'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '请先登录'
    })
  }

  try {
    const rows = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        description: apiKeys.description,
        keyPrefix: apiKeys.keyPrefix,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
        usageCount: apiKeys.usageCount
      })
      .from(apiKeys)
      .innerJoin(apiKeyPermissions, eq(apiKeyPermissions.apiKeyId, apiKeys.id))
      .where(
        and(
          eq(apiKeys.createdByUserId, user.id),
          eq(apiKeyPermissions.permission, PERSONAL_PERMISSION)
        )
      )
      .orderBy(desc(apiKeys.createdAt))

    const now = getBeijingTime()
    const items = rows.map((key) => {
      const expiresAt = key.expiresAt ? new Date(key.expiresAt) : null
      return {
        ...key,
        status: !key.isActive ? 'inactive' : expiresAt && now > expiresAt ? 'expired' : 'active'
      }
    })

    return {
      success: true,
      data: items
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: `获取个人集成令牌失败：${error.message}`
    })
  }
})
