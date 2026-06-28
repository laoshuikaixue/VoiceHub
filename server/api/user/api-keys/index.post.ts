import { apiKeyPermissions, apiKeys, db } from '~/drizzle/db'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { generateApiKey, hashApiKey } from '~~/server/utils/apiKeyUtils'

const PERSONAL_PERMISSION = 'songs:request'

const createPersonalApiKeySchema = z.object({
  name: z.string().min(1, '令牌名称不能为空').max(100, '令牌名称不能超过100个字符').optional(),
  description: z.string().max(500, '描述不能超过500个字符').optional().nullable()
})

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '请先登录'
    })
  }

  try {
    const body = await readBody(event)
    const validatedData = createPersonalApiKeySchema.parse(body || {})

    const apiKey = generateApiKey()
    const keyPrefix = apiKey.substring(0, 10)
    const keyHash = await hashApiKey(apiKey)
    const name = validatedData.name?.trim() || '个人 API Key'
    const description = validatedData.description?.trim() || '用于个人集成和投稿'

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${user.id}::bigint)`)

      const existingKeys = await tx
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .innerJoin(apiKeyPermissions, eq(apiKeyPermissions.apiKeyId, apiKeys.id))
        .where(
          and(
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

      if (existingKeys.length >= 5) {
        throw createError({
          statusCode: 400,
          message: '每个用户最多只能创建 5 个个人集成令牌'
        })
      }

      const apiKeyResult = await tx
        .insert(apiKeys)
        .values({
          name,
          description,
          keyPrefix,
          keyHash,
          isActive: true,
          expiresAt: null,
          usageCount: 0,
          createdByUserId: user.id
        })
        .returning({
          id: apiKeys.id,
          createdAt: apiKeys.createdAt
        })

      const createdApiKey = apiKeyResult[0]
      if (!createdApiKey) {
        throw createError({
          statusCode: 500,
          message: '创建个人 API Key 失败'
        })
      }

      const apiKeyId = createdApiKey.id

      await tx.insert(apiKeyPermissions).values({
        apiKeyId,
        permission: PERSONAL_PERMISSION
      })

      return {
        id: apiKeyId,
        name,
        description,
        keyPrefix,
        isActive: true,
        expiresAt: null,
        createdAt: createdApiKey.createdAt,
        lastUsedAt: null,
        usageCount: 0,
        status: 'active',
        apiKey
      }
    })

    return {
      success: true,
      message: '个人 API Key 创建成功',
      data: result
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    if (error.name === 'ZodError') {
      const issues = error.issues || error.errors || []
      throw createError({
        statusCode: 400,
        message: `请求参数验证失败：${issues.map((e: any) => e.message).join(', ')}`
      })
    }

    throw createError({
      statusCode: 500,
      message: `创建个人 API Key 失败：${error.message}`
    })
  }
})
