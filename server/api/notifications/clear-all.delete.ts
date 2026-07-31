import { and, eq, ne, or } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { notifications } from '~/drizzle/schema'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import {
  createNotificationUserDeleteUpdate,
  NOTIFICATION_SOURCES
} from '~~/server/utils/important-notification-policy'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '需要登录才能清空通知')
  }

  try {
    const visibleUserCondition = and(
      eq(notifications.userId, user.id),
      eq(notifications.userDeleted, false)
    )!
    // 同一事务内先软删后硬删，避免部分失败时状态不一致
    const { retainedNotifications, deletedNotifications } = await db.transaction(async (tx) => {
      const retained = await tx
        .update(notifications)
        .set(createNotificationUserDeleteUpdate())
        .where(
          and(
            visibleUserCondition,
            eq(notifications.type, 'SYSTEM_NOTICE'),
            eq(notifications.source, NOTIFICATION_SOURCES.ADMIN_MANUAL)
          )
        )
        .returning({ id: notifications.id })
      const deleted = await tx
        .delete(notifications)
        .where(
          and(
            visibleUserCondition,
            or(
              ne(notifications.type, 'SYSTEM_NOTICE'),
              ne(notifications.source, NOTIFICATION_SOURCES.ADMIN_MANUAL)
            )
          )
        )
        .returning({ id: notifications.id })
      return { retainedNotifications: retained, deletedNotifications: deleted }
    })

    return {
      success: true,
      count: retainedNotifications.length + deletedNotifications.length
    }
  } catch (error) {
    console.error('清空通知失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.NOTIFICATION_CLEAR_FAILED, '清空通知失败')
  }
})
