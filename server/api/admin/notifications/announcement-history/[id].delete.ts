import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { announcementHistory, systemSettings } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { canSendSystemNotification } from '~~/server/utils/important-notification-policy'

/**
 * 删除一条公告发布记录。
 *
 * 删除的是当前展示中的公告时，同时清空首页公告栏，保证记录与展示一致。
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录后删除公告')
  }

  if (!canSendSystemNotification(user.role)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.NOTIFICATION_ADMIN_REQUIRED,
      '只有管理员可以删除公告'
    )
  }

  const rawId = parseInt(String(getRouterParam(event, 'id') || ''), 10)
  if (!Number.isFinite(rawId) || rawId <= 0) {
    throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '公告记录不存在')
  }

  const [record] = await db
    .select({ id: announcementHistory.id, isActive: announcementHistory.isActive })
    .from(announcementHistory)
    .where(eq(announcementHistory.id, rawId))
    .limit(1)

  if (!record) {
    throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '公告记录不存在')
  }

  await db.delete(announcementHistory).where(eq(announcementHistory.id, rawId))

  if (record.isActive) {
    const [existing] = await db.select({ id: systemSettings.id }).from(systemSettings).limit(1)
    if (existing) {
      await db
        .update(systemSettings)
        .set({ announcement: null, announcementTitle: null, updatedAt: new Date() })
        .where(eq(systemSettings.id, existing.id))
    }
  }

  return { success: true }
})
