import { apiKeyPermissions, apiKeys, db } from '~/drizzle/db'
import { eq } from 'drizzle-orm'

/**
 * 删除API Key
 * DELETE /api/admin/api-keys/[id]
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
    // 检查API Key是否存在
    const existingApiKey = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name
      })
      .from(apiKeys)
      .where(eq(apiKeys.id, apiKeyId))
      .limit(1)

    if (existingApiKey.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'API Key不存在'
      })
    }

    const apiKeyName = existingApiKey[0].name

    // 开始事务删除
    await db.transaction(async (tx) => {
      // 删除API Key权限
      await tx.delete(apiKeyPermissions).where(eq(apiKeyPermissions.apiKeyId, apiKeyId))

      // 删除API访问日志（可选，根据业务需求决定是否保留历史日志）
      // 这里我们选择保留日志记录，只删除API Key本身
      // await tx.delete(apiLogs)
      //   .where(eq(apiLogs.apiKeyId, apiKeyId))

      // 删除API Key
      await tx.delete(apiKeys).where(eq(apiKeys.id, apiKeyId))
    })

    return {
      success: true,
      message: `API Key "${apiKeyName}" 删除成功`,
      data: {
        id: apiKeyId,
        name: apiKeyName
      }
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `删除API Key失败: ${error.message}`
    })
  }
})
