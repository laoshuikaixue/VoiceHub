import { apiKeyPermissions, apiKeys, db } from '~/drizzle/db'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { createApiError } from '~~/server/utils/apiError'

const PERSONAL_PERMISSION = 'songs:request'
const apiKeyIdSchema = z.string().uuid('无效的令牌 ID')

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_LOGIN_REQUIRED', '请先登录')
  }

  const apiKeyIdRaw = getRouterParam(event, 'id')
  if (!apiKeyIdRaw) {
    throw createApiError(400, 'USER_API_KEY_ID_REQUIRED', '令牌 ID 不能为空')
  }

  const parsedApiKeyId = apiKeyIdSchema.safeParse(apiKeyIdRaw)
  if (!parsedApiKeyId.success) {
    throw createError({
      statusCode: 400,
      message: parsedApiKeyId.error.issues[0]?.message || '无效的令牌 ID'
    })
  }

  const apiKeyId = parsedApiKeyId.data

  try {
    const existingApiKey = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name
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

    if (existingApiKey.length === 0) {
      throw createApiError(404, 'USER_API_KEY_NOT_FOUND', '个人集成令牌不存在')
    }

    const apiKey = existingApiKey[0]
    if (!apiKey) {
      throw createApiError(404, 'USER_API_KEY_NOT_FOUND', '个人集成令牌不存在')
    }

    await db.transaction(async (tx) => {
      await tx.delete(apiKeyPermissions).where(eq(apiKeyPermissions.apiKeyId, apiKeyId))
      await tx.delete(apiKeys).where(eq(apiKeys.id, apiKeyId))
    })

    return {
      success: true,
      message: `个人集成令牌 "${apiKey.name}" 已删除`,
      data: {
        id: apiKeyId,
        name: apiKey.name
      }
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createApiError(500, 'USER_API_KEY_DELETE_FAILED_DETAIL', `删除个人集成令牌失败：${error.message}`, { params: [error.message] })
  }
})
