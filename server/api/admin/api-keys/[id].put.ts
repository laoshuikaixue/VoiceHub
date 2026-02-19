import { apiKeyPermissions, apiKeys, db } from '~/drizzle/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getBeijingTime } from '~/utils/timeUtils'

/**
 * 更新API Key
 * PUT /api/admin/api-keys/[id]
 */

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
    .array(z.enum(['schedules:read', 'songs:read']))
    .min(1, '至少需要选择一个权限')
    .optional()
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

  const apiKeyId = getRouterParam(event, 'id')

  if (!apiKeyId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'API Key ID不能为空'
    })
  }

  try {
    // 验证请求体
    const body = await readBody(event)
    const validatedData = updateApiKeySchema.parse(body)

    // 检查API Key是否存在
    const existingApiKey = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(eq(apiKeys.id, apiKeyId))
      .limit(1)

    if (existingApiKey.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'API Key不存在'
      })
    }

    // 处理过期时间
    let expiresAt = undefined
    if ('expiresAt' in validatedData) {
      if (validatedData.expiresAt === null) {
        expiresAt = null
      } else if (validatedData.expiresAt) {
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
    }

    // 开始事务
    const result = await db.transaction(async (tx) => {
      // 准备更新数据
      const updateData: any = {}

      if (validatedData.name !== undefined) updateData.name = validatedData.name
      if ('description' in validatedData) updateData.description = validatedData.description
      if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive
      if ('expiresAt' in validatedData) updateData.expiresAt = expiresAt

      // 更新API Key基本信息
      await tx.update(apiKeys).set(updateData).where(eq(apiKeys.id, apiKeyId))

      // 更新权限（如果提供了权限数据）
      if (validatedData.permissions) {
        // 删除现有权限
        await tx.delete(apiKeyPermissions).where(eq(apiKeyPermissions.apiKeyId, apiKeyId))

        // 插入新权限
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
        id: result.apiKeyId
      }
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
      statusMessage: `更新API Key失败: ${error.message}`
    })
  }
})
