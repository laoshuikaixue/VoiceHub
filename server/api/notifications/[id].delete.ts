import { and, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { notifications } from '~/drizzle/schema'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import {
  createNotificationUserDeleteUpdate,
  shouldRetainNotificationHistory
} from '~~/server/utils/important-notification-policy'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '需要登录才能删除通知')
  }

  const id = Number.parseInt(event.context.params?.id || '0', 10)
  if (!Number.isInteger(id) || id <= 0) {
    throw createApiError(400, SERVER_ERROR_CODES.NOTIFICATION_ID_INVALID, '无效的通知 ID')
  }

  try {
    const notification = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        source: notifications.source
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, user.id),
          eq(notifications.userDeleted, false)
        )
      )
      .then((result) => result[0])

    if (!notification) {
      throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '通知不存在')
    }

    if (shouldRetainNotificationHistory(notification.type, notification.source)) {
      const result = await db
        .update(notifications)
        .set(createNotificationUserDeleteUpdate())
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.userId, user.id),
            eq(notifications.userDeleted, false)
          )
        )
        .returning({ id: notifications.id })
      if (result.length === 0) {
        throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '通知不存在')
      }
    } else {
      const result = await db
        .delete(notifications)
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.userId, user.id),
            eq(notifications.userDeleted, false)
          )
        )
        .returning({ id: notifications.id })
      if (result.length === 0) {
        throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '通知不存在')
      }
    }

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error && 'statusCode' in error) throw error
    console.error('删除通知失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.NOTIFICATION_DELETE_FAILED, '删除通知失败')
  }
})
