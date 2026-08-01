import { and, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { notifications } from '~/drizzle/schema'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import { createNotificationReadUpdate } from '~~/server/utils/important-notification-policy'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '需要登录才能标记通知')
  }

  try {
    const updatedNotifications = await db
      .update(notifications)
      .set(createNotificationReadUpdate())
      .where(
        and(
          eq(notifications.userId, user.id),
          eq(notifications.userDeleted, false),
          eq(notifications.read, false)
        )
      )
      .returning({ id: notifications.id })

    return {
      success: true,
      count: updatedNotifications.length
    }
  } catch (error) {
    console.error('标记所有通知失败:', error)
    throw createApiError(
      500,
      SERVER_ERROR_CODES.NOTIFICATION_MARK_READ_FAILED,
      '标记所有通知失败'
    )
  }
})
