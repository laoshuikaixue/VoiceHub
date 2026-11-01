import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { announcementHistory, systemSettings } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { canSendSystemNotification } from '~~/server/utils/important-notification-policy'

/**
 * 清空首页公告栏。只清空展示内容，历史发布记录保留，便于回溯。
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '需要登录才能清空公告')
  }

  if (!canSendSystemNotification(user.role)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.NOTIFICATION_ADMIN_REQUIRED,
      '只有管理员可以清空公告'
    )
  }

  const [existing] = await db.select({ id: systemSettings.id }).from(systemSettings).limit(1)
  if (existing) {
    await db
      .update(systemSettings)
      .set({ announcement: null, announcementTitle: null, updatedAt: new Date() })
      .where(eq(systemSettings.id, existing.id))
  }

  await db
    .update(announcementHistory)
    .set({ isActive: false })
    .where(eq(announcementHistory.isActive, true))

  return { success: true }
})
