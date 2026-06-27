import { apiKeyPermissions, apiKeys, apiLogs, db } from '~/drizzle/db'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getBeijingTime } from '~/utils/timeUtils'

const PERSONAL_PERMISSION = 'songs:request'
const apiKeyIdSchema = z.string().uuid('无效的令牌 ID')

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '请先登录'
    })
  }

  const apiKeyIdRaw = getRouterParam(event, 'id')
  if (!apiKeyIdRaw) {
    throw createError({
      statusCode: 400,
      message: '令牌 ID 不能为空'
    })
  }

  const parsedApiKeyId = apiKeyIdSchema.safeParse(apiKeyIdRaw)
  if (!parsedApiKeyId.success) {
    throw createError({
      statusCode: 400,
      message: parsedApiKeyId.error.issues[0]?.message || '无效的令牌 ID'
    })
  }

  const apiKeyId = parsedApiKeyId.data
  const query = getQuery(event)
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 10))
  const offset = (page - 1) * limit

  try {
    const apiKeyResult = await db
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
          eq(apiKeys.id, apiKeyId),
          eq(apiKeys.createdByUserId, user.id),
          eq(apiKeyPermissions.permission, PERSONAL_PERMISSION),
          sql`NOT EXISTS (
            SELECT 1
            FROM ${apiKeyPermissions}
            WHERE ${apiKeyPermissions.apiKeyId} = ${apiKeys.id}
              AND ${apiKeyPermissions.permission} != ${PERSONAL_PERMISSION}
          )`
        )
      )
      .limit(1)

    const apiKey = apiKeyResult[0]
    if (!apiKey) {
      throw createError({
        statusCode: 404,
        message: '个人集成令牌不存在'
      })
    }

    const logs = await db
      .select({
        id: apiLogs.id,
        endpoint: apiLogs.endpoint,
        method: apiLogs.method,
        ipAddress: apiLogs.ipAddress,
        userAgent: apiLogs.userAgent,
        statusCode: apiLogs.statusCode,
        responseTimeMs: apiLogs.responseTimeMs,
        errorMessage: apiLogs.errorMessage,
        createdAt: apiLogs.createdAt
      })
      .from(apiLogs)
      .where(eq(apiLogs.apiKeyId, apiKeyId))
      .orderBy(desc(apiLogs.createdAt))
      .limit(limit)
      .offset(offset)

    const totalResult = await db
      .select({ count: count() })
      .from(apiLogs)
      .where(eq(apiLogs.apiKeyId, apiKeyId))

    const total = Number(totalResult[0]?.count || 0)
    const expiresAt = apiKey.expiresAt ? new Date(apiKey.expiresAt) : null
    const now = getBeijingTime()
    const status = !apiKey.isActive ? 'inactive' : expiresAt && now > expiresAt ? 'expired' : 'active'

    return {
      success: true,
      data: {
        apiKey: {
          ...apiKey,
          status
        },
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: `获取个人集成令牌日志失败：${error.message}`
    })
  }
})
