import { and, asc, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { notifications } from '~/drizzle/schema'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import {
  serializeNotificationSender,
  shouldCheckImportantNotification
} from '~~/server/utils/important-notification-policy'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!shouldCheckImportantNotification(Boolean(user), user?.id, user?.requirePasswordChange === true)) {
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
        senderId: notifications.senderId,
        senderName: notifications.senderName,
        senderUsername: notifications.senderUsername,
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
          eq(notifications.userDeleted, false),
          eq(notifications.important, true),
          eq(notifications.read, false)
        )
      )
      .orderBy(asc(notifications.createdAt), asc(notifications.id))
      .limit(1)

    const notification = result[0]
    if (!notification) return { notification: null }

    const { senderId, senderName, senderUsername, ...data } = notification
    return {
      notification: {
        ...data,
        sender: serializeNotificationSender({ senderId, senderName, senderUsername })
      }
    }
  } catch (error) {
    console.error('获取重要通知失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.NOTIFICATION_FETCH_FAILED, '获取重要通知失败')
  }
})
