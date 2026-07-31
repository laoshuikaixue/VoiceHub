import { and, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { notifications } from '~/drizzle/schema'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import { createNotificationReadUpdate, serializeNotificationSender } from '~~/server/utils/important-notification-policy'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '需要登录才能标记通知')
  }

  const id = Number.parseInt(event.context.params?.id || '0', 10)
  if (!Number.isInteger(id) || id <= 0) {
    throw createApiError(400, SERVER_ERROR_CODES.NOTIFICATION_ID_INVALID, '无效的通知 ID')
  }

  let notification
  try {
    notification = await db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        userDeleted: notifications.userDeleted
      })
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1)
      .then((result) => result[0])
  } catch (error) {
    console.error('查询待标记通知失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.NOTIFICATION_MARK_READ_FAILED, '标记通知失败')
  }

  if (!notification || notification.userDeleted) {
    throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '通知不存在')
  }

  if (notification.userId !== user.id) {
    throw createApiError(403, SERVER_ERROR_CODES.NOTIFICATION_FORBIDDEN, '无权标记此通知')
  }

  try {
    const updatedNotification = await db
      .update(notifications)
      .set(createNotificationReadUpdate())
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, user.id),
          eq(notifications.userDeleted, false)
        )
      )
      .returning()
      .then((result) => result[0])

    // 与 /api/notifications 列表接口保持同一序列化契约，发送人原始列折叠为 sender 对象
    if (!updatedNotification) {
      throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '通知不存在')
    }
    const { senderId, senderName, senderUsername, ...data } = updatedNotification
    return {
      ...data,
      sender: serializeNotificationSender({ senderId, senderName, senderUsername })
    }
  } catch (error) {
    console.error('标记通知失败:', error)
    if ((error as { statusCode?: number })?.statusCode === 404) throw error
    throw createApiError(500, SERVER_ERROR_CODES.NOTIFICATION_MARK_READ_FAILED, '标记通知失败')
  }
})
