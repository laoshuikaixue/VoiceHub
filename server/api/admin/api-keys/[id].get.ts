import { apiKeyPermissions, apiKeys, db, users } from '~/drizzle/db'
import { eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac/guards'
import { PERMISSIONS } from '~~/server/utils/rbac/constants'

/**
 * 获取API Key详情
 * GET /api/admin/api-keys/[id]
 */
export default defineEventHandler(async (event) => {
  // 检查用户权限
  await requirePermission(event, PERMISSIONS.API_KEYS_READ)

  const apiKeyId = getRouterParam(event, 'id')

  if (!apiKeyId) {
    throw createError({
      statusCode: 400,
      message: 'API Key ID 不能为空'
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
        creatorName: users.name,
        ownerType: apiKeys.ownerType,
        ownerId: apiKeys.ownerId,
        rateLimitPerMinute: apiKeys.rateLimitPerMinute,
        quotaDaily: apiKeys.quotaDaily,
        quotaMonthly: apiKeys.quotaMonthly,
        ipWhitelist: apiKeys.ipWhitelist,
        webhookUrl: apiKeys.webhookUrl,
        hasWebhookSecret: apiKeys.webhookSecretHash
      })
      .from(apiKeys)
      .leftJoin(users, eq(apiKeys.createdByUserId, users.id))
      .where(eq(apiKeys.id, apiKeyId))
      .limit(1)

    const apiKey = apiKeyResult[0]

    if (!apiKey) {
      throw createError({
        statusCode: 404,
        message: 'API Key 不存在'
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

    // 解析 IP 白名单为对象数组（前端友好）
    let ipWhitelist: string[] = []
    if (apiKey.ipWhitelist) {
      try {
        const parsed = JSON.parse(apiKey.ipWhitelist)
        if (Array.isArray(parsed)) ipWhitelist = parsed.filter((x) => typeof x === 'string')
      } catch {
        ipWhitelist = []
      }
    }

    // 计算状态
    const isExpired = apiKey.expiresAt ? new Date() > apiKey.expiresAt : false
    const status = !apiKey.isActive ? 'inactive' : isExpired ? 'expired' : 'active'

    return {
      success: true,
      data: {
        ...apiKey,
        ipWhitelist,
        hasWebhookSecret: !!apiKey.hasWebhookSecret,
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
      message: `获取 API Key 详情失败：${error.message}`
    })
  }
})
