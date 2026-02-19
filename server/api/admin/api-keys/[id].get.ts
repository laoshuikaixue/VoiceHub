import { apiKeyPermissions, apiKeys, db, users } from '~/drizzle/db'
import { eq } from 'drizzle-orm'

/**
 * 获取API Key详情
 * GET /api/admin/api-keys/[id]
 */
export default defineEventHandler(async (event) => {
  // 检查用户权限 - 只有超级管理员可以管理API Key
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: '只有超级管理员可以管理API Key'
    })
  }

  const apiKeyId = getRouterParam(event, 'id')

  if (!apiKeyId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'API Key ID不能为空'
    })
  }

  try {
    // 获取API Key基本信息
    const apiKeyResult = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        description: apiKeys.description,
        keyPrefix: apiKeys.keyPrefix,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,

        usageCount: apiKeys.usageCount,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
        updatedAt: apiKeys.updatedAt,
        createdBy: apiKeys.createdByUserId,
        creatorName: users.name
      })
      .from(apiKeys)
      .leftJoin(users, eq(apiKeys.createdByUserId, users.id))
      .where(eq(apiKeys.id, apiKeyId))
      .limit(1)

    const apiKey = apiKeyResult[0]

    if (!apiKey) {
      throw createError({
        statusCode: 404,
        statusMessage: 'API Key不存在'
      })
    }

    // 获取API Key权限
    const permissionsResult = await db
      .select({
        permission: apiKeyPermissions.permission
      })
      .from(apiKeyPermissions)
      .where(eq(apiKeyPermissions.apiKeyId, apiKeyId))

    const permissions = permissionsResult.map((p) => p.permission)

    // 计算状态
    const isExpired = apiKey.expiresAt ? new Date() > apiKey.expiresAt : false
    const status = !apiKey.isActive ? 'inactive' : isExpired ? 'expired' : 'active'

    return {
      success: true,
      data: {
        ...apiKey,
        permissions,
        isExpired,
        status
      }
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `获取API Key详情失败: ${error.message}`
    })
  }
})
