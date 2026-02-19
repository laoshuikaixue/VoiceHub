import { apiKeyPermissions, apiKeys, db } from '~/drizzle/db'
import crypto from 'crypto'
import { z } from 'zod'
import { getBeijingTime } from '~/utils/timeUtils'

/**
 * 创建API Key
 * POST /api/admin/api-keys
 */

// 请求体验证schema
const createApiKeySchema = z.object({
  name: z.string().min(1, 'API Key名称不能为空').max(100, 'API Key名称不能超过100个字符'),
  description: z
    .union([z.string().max(500, '描述不能超过500个字符'), z.null(), z.undefined()])
    .optional(),
  expiresAt: z.union([z.string(), z.null(), z.undefined()]).optional(),

  permissions: z.array(z.enum(['schedules:read', 'songs:read'])).min(1, '至少需要选择一个权限')
})

export default defineEventHandler(async (event) => {
  // 检查用户权限 - 只有超级管理员可以管理API Key
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: '只有超级管理员可以管理API Key'
    })
  }

  try {
    // 验证请求体
    const body = await readBody(event)
    const validatedData = createApiKeySchema.parse(body)

    // 生成API Key
    const apiKey = generateApiKey()
    const keyPrefix = apiKey.substring(0, 10) // vhub_xxxxx
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

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
              statusMessage: '无效的过期时间格式'
            })
          }
          // 验证过期时间不能是过去的时间
          if (expiresAt <= getBeijingTime()) {
            throw createError({
              statusCode: 400,
              statusMessage: '过期时间不能是过去的时间'
            })
          }
        }
      } catch (error: any) {
        if (error.statusCode) {
          throw error
        }
        throw createError({
          statusCode: 400,
          statusMessage: '无效的过期时间格式'
        })
      }
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
          createdByUserId: user.id
        })
        .returning({ id: apiKeys.id })

      const apiKeyId = apiKeyResult[0].id

      // 插入权限记录
      const permissionValues = validatedData.permissions.map((permission) => ({
        apiKeyId,
        permission
      }))

      await tx.insert(apiKeyPermissions).values(permissionValues)

      return {
        id: apiKeyId,
        apiKey, // 只在创建时返回完整的API Key
        name: validatedData.name,
        description: validatedData.description,
        keyPrefix,
        isActive: true,
        expiresAt,

        permissions: validatedData.permissions,
        usageCount: 0,
        createdBy: user.id,
        creatorName: user.name
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

    // 处理Zod验证错误
    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        statusMessage: `请求参数验证失败: ${error.errors.map((e: any) => e.message).join(', ')}`
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: `创建API Key失败: ${error.message}`
    })
  }
})

/**
 * 生成API Key
 * 格式: vhub_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (37字符)
 */
function generateApiKey(): string {
  const prefix = 'vhub_'
  const randomBytes = crypto.randomBytes(16).toString('hex') // 32字符
  return prefix + randomBytes
}
