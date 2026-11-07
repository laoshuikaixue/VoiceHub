import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { announcementHistory, systemSettings } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { hasAdminPermission } from '~/utils/admin-permissions'

/**
 * 把一条历史公告设为当前展示中的公告。
 *
 * 将其余记录全部标记为非展示，并把目标记录的标题、内容、展示方式、
 * 滚动速度、对齐方式同步到 SystemSettings，让首页公告栏立即切换。
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录后操作公告')
  }

  if (!hasAdminPermission(user, 'notifications:write')) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.NOTIFICATION_ADMIN_REQUIRED,
      '只有管理员可以切换展示公告'
    )
  }

  const rawId = parseInt(String(getRouterParam(event, 'id') || ''), 10)
  if (!Number.isFinite(rawId) || rawId <= 0) {
    throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '公告记录不存在')
  }

  const [record] = await db
    .select()
    .from(announcementHistory)
    .where(eq(announcementHistory.id, rawId))
    .limit(1)

  if (!record) {
    throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '公告记录不存在')
  }

  await db.update(announcementHistory).set({ isActive: false })

  await db
    .update(announcementHistory)
    .set({ isActive: true })
    .where(eq(announcementHistory.id, rawId))

  const [existing] = await db.select({ id: systemSettings.id }).from(systemSettings).limit(1)
  if (existing) {
    await db
      .update(systemSettings)
      .set({
        announcementTitle: record.title,
        announcement: record.content,
        announcementDisplayMode: record.displayMode,
        announcementScrollSpeed: record.scrollSpeed,
        announcementAlignment: record.alignment,
        updatedAt: new Date()
      })
      .where(eq(systemSettings.id, existing.id))
  } else {
    await db.insert(systemSettings).values({
      announcementTitle: record.title,
      announcement: record.content,
      announcementDisplayMode: record.displayMode,
      announcementScrollSpeed: record.scrollSpeed,
      announcementAlignment: record.alignment
    })
  }

  return { success: true }
})
