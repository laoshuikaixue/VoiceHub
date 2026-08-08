import { apiKeyPermissions, apiKeys, db } from '~/drizzle/db'
import { eq } from 'drizzle-orm'
import { getAdminOperationFailureCode, recordAdminOperation, shouldRecordAdminOperationFailure } from '~~/server/services/adminOperationLogService'

/**
 * 删除API Key
 * DELETE /api/admin/api-keys/[id]
 */
export default defineEventHandler(async (event) => {
  // 检查用户权限 - 只有超级管理员可以管理 API Key
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    if (user) {
      await recordAdminOperation(event, { actor: { id: user.id, role: user.role }, action: 'API_KEY.DELETE', targetType: 'API_KEY', targetId: getRouterParam(event, 'id'), result: 'FAILURE', summary: '管理员删除 API Key 被拒绝', failureCode: 'HTTP_403' })
    }
    throw createError({
      statusCode: 403,
      message: '只有超级管理员可以管理 API Key'
    })
  }

  const apiKeyId = getRouterParam(event, 'id')

  if (!apiKeyId) {
    throw createError({
      statusCode: 400,
      message: 'API Key ID 不能为空'
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
        message: 'API Key 不存在'
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

    await recordAdminOperation(event, {
      actor: { id: user.id, role: user.role },
      action: 'API_KEY.DELETE',
      targetType: 'API_KEY',
      targetId: apiKeyId,
      targetLabel: apiKeyName,
      result: 'SUCCESS',
      summary: '管理员删除了 API Key'
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
      if (shouldRecordAdminOperationFailure(error)) {
        await recordAdminOperation(event, { actor: { id: user.id, role: user.role }, action: 'API_KEY.DELETE', targetType: 'API_KEY', targetId: apiKeyId, result: 'FAILURE', summary: '管理员删除 API Key 失败', failureCode: getAdminOperationFailureCode(error, 'API_KEY_DELETE_FAILED') })
      }
      throw error
    }

    await recordAdminOperation(event, { actor: { id: user.id, role: user.role }, action: 'API_KEY.DELETE', targetType: 'API_KEY', targetId: apiKeyId, result: 'FAILURE', summary: '管理员删除 API Key 失败', failureCode: getAdminOperationFailureCode(error, 'API_KEY_DELETE_FAILED') })

    throw createError({
      statusCode: 500,
      message: `删除 API Key 失败：${error.message}`
    })
  }
})
