import { apiKeyPermissions, apiKeys, db } from '~/drizzle/db'
import { z } from 'zod'
import { getBeijingTime } from '~/utils/timeUtils'
import { apiPermissionSchema } from './permissions'
import {
  generateApiKey,
  generateWebhookSecret,
  hashApiKey,
  hashWebhookSecret
} from '~~/server/utils/apiKeyUtils'
import { requirePermission } from '~~/server/utils/rbac/guards'
import { PERMISSIONS } from '~~/server/utils/rbac/constants'

/**
 * 创建API Key
 * POST /api/admin/api-keys
 */

// 请求体验证schema
const ipEntrySchema = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (v) =>
      // 单 IP 或 CIDR（IPv4 简单校验）
      /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(v.trim()),
    'IP 白名单格式无效（需为单 IP 或 CIDR）'
  )

const createApiKeySchema = z.object({
  name: z.string().min(1, 'API Key名称不能为空').max(100, 'API Key名称不能超过100个字符'),
  description: z
    .union([z.string().max(500, '描述不能超过500个字符'), z.null(), z.undefined()])
    .optional(),
  expiresAt: z.union([z.string(), z.null(), z.undefined()]).optional(),

  permissions: z.array(apiPermissionSchema).min(1, '至少需要选择一个权限'),
  ownerType: z.enum(['system', 'user', 'integration']).optional(),
  ownerId: z.number().int().positive().optional(),
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
  ipWhitelist: z.array(ipEntrySchema).max(64).optional(),
  webhookUrl: z
    .string()
    .url('webhookUrl 必须为合法 URL')
    .max(500)
    .nullable()
    .optional()
})

export default defineEventHandler(async (event) => {
  // 检查用户权限：创建 API Key 需要 api_keys.write
  const user = await requirePermission(event, PERMISSIONS.API_KEYS_WRITE)

  try {
    // 验证请求体
    const body = await readBody(event)
    const validatedData = createApiKeySchema.parse(body)

    // 生成API Key
    const apiKey = generateApiKey()
    const keyPrefix = apiKey.substring(0, 10) // vhub_xxxxx
    const keyHash = await hashApiKey(apiKey)

    // 处理过期时间
    let expiresAt: Date | null = null
    if (
      validatedData.expiresAt &&
      typeof validatedData.expiresAt === 'string' &&
      validatedData.expiresAt.trim() !== ''
    ) {
      try {
        // 处理预设选项格式 (3d, 7d, 30d, 60d, 90d)
        if (validatedData.expiresAt.match(/^\d+d$/)) {
          const days = parseInt(validatedData.expiresAt.replace('d', ''))
          expiresAt = getBeijingTime()
          expiresAt.setDate(expiresAt.getDate() + days)
        } else {
          // 处理传统的日期时间格式（向后兼容）
          expiresAt = new Date(validatedData.expiresAt)
          // 验证日期是否有效
          if (isNaN(expiresAt.getTime())) {
            throw createError({
              statusCode: 400,
              message: '无效的过期时间格式'
            })
          }
          // 验证过期时间不能是过去的时间
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

    // Webhook secret：若用户提供 webhookUrl，则生成明文 + 哈希
    // 创建响应一次性返回明文，DB 仅存哈希
    let webhookSecretPlain: string | null = null
    let webhookSecretHash: string | null = null
    if (validatedData.webhookUrl) {
      webhookSecretPlain = generateWebhookSecret()
      webhookSecretHash = await hashWebhookSecret(webhookSecretPlain)
    }

    // 开始事务
    const result = await db.transaction(async (tx) => {
      // 插入API Key记录
      const apiKeyResult = await tx
        .insert(apiKeys)
        .values({
          name: validatedData.name,
          description: validatedData.description || null,
          keyPrefix,
          keyHash,
          isActive: true,
          expiresAt,

          usageCount: 0,
          createdByUserId: user.id,
          ownerType: validatedData.ownerType ?? 'system',
          ownerId: validatedData.ownerId ?? null,
          rateLimitPerMinute: validatedData.rateLimitPerMinute ?? null,
          quotaDaily: validatedData.quotaDaily ?? null,
          quotaMonthly: validatedData.quotaMonthly ?? null,
          ipWhitelist: validatedData.ipWhitelist
            ? JSON.stringify(validatedData.ipWhitelist)
            : null,
          webhookUrl: validatedData.webhookUrl ?? null,
          webhookSecretHash
        })
        .returning({ id: apiKeys.id })

      const createdApiKey = apiKeyResult[0]
      if (!createdApiKey) {
        throw createError({
          statusCode: 500,
          message: '创建 API Key 失败'
        })
      }

      const apiKeyId = createdApiKey.id

      // 插入权限记录
      const permissionValues = validatedData.permissions.map((permission) => ({
        apiKeyId,
        permission
      }))

      await tx.insert(apiKeyPermissions).values(permissionValues)

      return {
        id: apiKeyId,
        apiKey,
        name: validatedData.name,
        description: validatedData.description,
        keyPrefix,
        isActive: true,
        expiresAt,

        permissions: validatedData.permissions,
        usageCount: 0,
        createdBy: user.id,
        creatorName: user.name,
        ownerType: validatedData.ownerType ?? 'system',
        ownerId: validatedData.ownerId ?? null,
        rateLimitPerMinute: validatedData.rateLimitPerMinute ?? null,
        quotaDaily: validatedData.quotaDaily ?? null,
        quotaMonthly: validatedData.quotaMonthly ?? null,
        ipWhitelist: validatedData.ipWhitelist ?? null,
        webhookUrl: validatedData.webhookUrl ?? null,
        // 一次性明文返回（创建响应外不再返回）
        webhookSecret: webhookSecretPlain
      }
    })

    return {
      success: true,
      message: 'API Key创建成功',
      data: result
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    // 处理 Zod 验证错误
    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        message: `请求参数验证失败：${error.errors.map((e: any) => e.message).join(', ')}`
      })
    }

    throw createError({
      statusCode: 500,
      message: `创建 API Key 失败：${error.message}`
    })
  }
})

