import { and, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { notifications } from '~/drizzle/schema'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import { NOTIFICATION_SOURCES } from '~~/server/utils/important-notification-policy'
import { resolveNotificationBatchReference } from '~~/server/utils/notification-history-policy'
import { canSendNotifications } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  // 权限：notification.send（ADMIN 及以上）；未登录 401 / 账号异常 403 / 缺权限 403
  await canSendNotifications(event)

  const batchReference = resolveNotificationBatchReference(getRouterParam(event, 'batchId'))
  if (!batchReference) {
    throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '通知不存在')
  }

  const batchCondition = batchReference.batchId
    ? eq(notifications.batchId, batchReference.batchId)
    : eq(notifications.id, batchReference.notificationId!)

  let deletedRows
  try {
    deletedRows = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.type, 'SYSTEM_NOTICE'),
          eq(notifications.source, NOTIFICATION_SOURCES.ADMIN_MANUAL),
          batchCondition
        )
      )
      .returning({ id: notifications.id })
  } catch (error) {
    console.error('删除通知失败:', error)
    throw createApiError(
      500,
      SERVER_ERROR_CODES.NOTIFICATION_HISTORY_DELETE_FAILED,
      '删除通知失败'
    )
  }

  if (deletedRows.length === 0) {
    throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '通知不存在')
  }

  return {
    success: true,
    deletedCount: deletedRows.length
  }
})
