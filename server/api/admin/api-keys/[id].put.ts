import { apiKeyPermissions, apiKeys, db } from '~/drizzle/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getBeijingTime } from '~/utils/timeUtils'
import { apiPermissionSchema } from './permissions'
import { requirePermission } from '~~/server/utils/rbac/guards'
import { PERMISSIONS } from '~~/server/utils/rbac/constants'
import {
  generateWebhookSecret,
  hashWebhookSecret
} from '~~/server/utils/apiKeyUtils'

/**
 * 更新API Key
 * PUT /api/admin/api-keys/[id]
 */

const ipEntrySchema = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (v) => /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(v.trim()),
    'IP 白名单格式无效'
  )

// 请求体验证schema
const updateApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'API Key名称不能为空')
    .max(100, 'API Key名称不能超过100个字符')
    .optional(),
  description: z.string().max(500, '描述不能超过500个字符').optional().nullable(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().optional().nullable(),

  permissions: z
    .array(apiPermissionSchema)
    .min(1, '至少需要选择一个权限')
    .optional(),
  ownerType: z.enum(['system', 'user', 'integration']).optional(),
  ownerId: z.number().int().positive().optional().nullable(),
  rateLimitPerMinute: z.number().int().positive().nullable().optional(),
  quotaDaily: z
    .number()
    .int()
    .refine((v) => v == null || v > 0, 'quotaDaily 必须为正整数或 null')
    .nullable()
    .optional(),
  quotaMonthly: z
    .number()
    .int()
    .refine((v) => v == null || v > 0, 'quotaMonthly 必须为正整数或 null')
    .nullable()
    .optional(),
  ipWhitelist: z.array(ipEntrySchema).max(64).optional().nullable(),
  webhookUrl: z
    .string()
    .url('webhookUrl 必须为合法 URL')
    .max(500)
    .nullable()
    .optional(),
  // 显式 true 表示重置 webhook secret 并在响应里返回新明文
  resetWebhookSecret: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  // 检查用户权限：更新 API Key 需要 api_keys.write
  await requirePermission(event, PERMISSIONS.API_KEYS_WRITE)

  const apiKeyId = getRouterParam(event, 'id')

  if (!apiKeyId) {
    throw createError({
      statusCode: 400,
      message: 'API Key ID 不能为空'
    })
  }

  try {
    // 验证请求体
    const body = await readBody(event)
    const validatedData = updateApiKeySchema.parse(body)

    // 检查API Key是否存在
    const existingApiKey = await db
      .select({ id: apiKeys.id, webhookUrl: apiKeys.webhookUrl })
      .from(apiKeys)
      .where(eq(apiKeys.id, apiKeyId))
      .limit(1)

    if (existingApiKey.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'API Key 不存在'
      })
    }

    // 处理过期时间
    let expiresAt = undefined
    if ('expiresAt' in validatedData) {
      if (validatedData.expiresAt === null) {
        expiresAt = null
      } else if (validatedData.expiresAt) {
        try {
          if (validatedData.expiresAt.match(/^\d+d$/)) {
            const days = parseInt(validatedData.expiresAt.replace('d', ''))
            expiresAt = getBeijingTime()
            expiresAt.setDate(expiresAt.getDate() + days)
          } else {
            expiresAt = new Date(validatedData.expiresAt)
            if (isNaN(expiresAt.getTime())) {
              throw createError({
                statusCode: 400,
                message: '无效的过期时间格式'
              })
            }
            if (expiresAt <= getBeijingTime()) {
              throw createError({
                statusCode: 400,
                message: '过期时间不能是过去的时间'
              })
            }
          }
        } catch (error: any) {
          if (error.statusCode) {
            throw error
          }
          throw createError({
            statusCode: 400,
            message: '无效的过期时间格式'
          })
        }
      }
    }

    // webhook_secret 重置：仅在用户显式传 resetWebhookSecret=true 时才重新生成
    // 创建/更新后响应里返回新明文（一次性）
    let newWebhookSecretPlain: string | null = null
    if (validatedData.resetWebhookSecret === true) {
      newWebhookSecretPlain = generateWebhookSecret()
    }

    // 开始事务
    const result = await db.transaction(async (tx) => {
      // 准备更新数据
      const updateData: any = {}

      if (validatedData.name !== undefined) updateData.name = validatedData.name
      if ('description' in validatedData) updateData.description = validatedData.description
      if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive
      if ('expiresAt' in validatedData) updateData.expiresAt = expiresAt
      if (validatedData.ownerType !== undefined) updateData.ownerType = validatedData.ownerType
      if ('ownerId' in validatedData) updateData.ownerId = validatedData.ownerId ?? null
      if (validatedData.rateLimitPerMinute !== undefined) {
        updateData.rateLimitPerMinute = validatedData.rateLimitPerMinute ?? null
      }
      if (validatedData.quotaDaily !== undefined) {
        updateData.quotaDaily = validatedData.quotaDaily ?? null
      }
      if (validatedData.quotaMonthly !== undefined) {
        updateData.quotaMonthly = validatedData.quotaMonthly ?? null
      }
      if (validatedData.ipWhitelist !== undefined) {
        updateData.ipWhitelist = validatedData.ipWhitelist
          ? JSON.stringify(validatedData.ipWhitelist)
          : null
      }
      if (validatedData.webhookUrl !== undefined) {
        updateData.webhookUrl = validatedData.webhookUrl ?? null
        // 把 webhookUrl 置空时同时清掉 secret
        if (validatedData.webhookUrl === null || validatedData.webhookUrl === '') {
          updateData.webhookSecretHash = null
        }
      }
      if (newWebhookSecretPlain) {
        updateData.webhookSecretHash = await hashWebhookSecret(newWebhookSecretPlain)
      }

      if (Object.keys(updateData).length > 0) {
        await tx.update(apiKeys).set(updateData).where(eq(apiKeys.id, apiKeyId))
      }

      // 更新权限（如果提供了权限数据）
      if (validatedData.permissions) {
        await tx.delete(apiKeyPermissions).where(eq(apiKeyPermissions.apiKeyId, apiKeyId))

        const permissionValues = validatedData.permissions.map((permission) => ({
          apiKeyId,
          permission
        }))

        await tx.insert(apiKeyPermissions).values(permissionValues)
      }

      return { apiKeyId }
    })

    return {
      success: true,
      message: 'API Key更新成功',
      data: {
        id: result.apiKeyId,
        // 重置 secret 时一次性返回新明文
        ...(newWebhookSecretPlain ? { webhookSecret: newWebhookSecretPlain } : {})
      }
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        message: `请求参数验证失败：${error.errors.map((e: any) => e.message).join(', ')}`
      })
    }

    throw createError({
      statusCode: 500,
      message: `更新 API Key 失败：${error.message}`
    })
  }
})
