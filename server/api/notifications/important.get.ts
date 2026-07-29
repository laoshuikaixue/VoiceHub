import { and, asc, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { notifications } from '~/drizzle/schema'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import { shouldCheckImportantNotification } from '~~/server/utils/important-notification-policy'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!shouldCheckImportantNotification(Boolean(user), user?.id)) {
    throw createApiError(
      401,
      SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED,
      '需要登录才能获取重要通知'
    )
  }

  try {
    const result = await db
      .select({
        id: notifications.id,
        title: notifications.title,
        message: notifications.message,
        important: notifications.important,
        read: notifications.read,
        createdAt: notifications.createdAt
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, user.id),
          eq(notifications.important, true),
          eq(notifications.read, false)
        )
      )
      .orderBy(asc(notifications.createdAt), asc(notifications.id))
      .limit(1)

    return { notification: result[0] || null }
  } catch (error) {
    console.error('获取重要通知失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.NOTIFICATION_FETCH_FAILED, '获取重要通知失败')
  }
})
