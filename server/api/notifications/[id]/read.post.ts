import { db } from '~/drizzle/db'
import { notifications } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能标记通知'
    })
  }

  // 获取通知ID
  const id = parseInt(event.context.params?.id || '0')

  if (isNaN(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      message: '无效的通知ID'
    })
  }

  try {
    // 检查通知是否属于当前用户
    const notificationResult = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1)
    const notification = notificationResult[0]

    if (!notification) {
      throw createError({
        statusCode: 404,
        message: '通知不存在'
      })
    }

    if (notification.userId !== user.id) {
      throw createError({
        statusCode: 403,
        message: '无权标记此通知'
      })
    }

    // 标记为已读
    const updatedNotificationResult = await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id))
      .returning()
    const updatedNotification = updatedNotificationResult[0]

    return updatedNotification
  } catch (err) {
    console.error('标记通知失败:', err)
    throw createError({
      statusCode: 500,
      message: '标记通知失败'
    })
  }
})
