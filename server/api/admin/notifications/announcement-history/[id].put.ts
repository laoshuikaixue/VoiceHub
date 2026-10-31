import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { announcementHistory, systemSettings } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  canSendSystemNotification,
  NOTIFICATION_CONTENT_MAX_LENGTH
} from '~~/server/utils/important-notification-policy'

const ANNOUNCEMENT_TITLE_MAX_LENGTH = 120
const MIN_SCROLL_SPEED = 8
const MAX_SCROLL_SPEED = 120

const normalizeDisplayMode = (value: unknown) => (value === 'scroll' ? 'scroll' : 'static')

const normalizeScrollSpeed = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 30
  return Math.min(MAX_SCROLL_SPEED, Math.max(MIN_SCROLL_SPEED, Math.round(parsed)))
}

/**
 * 修改一条公告发布记录。
 *
 * 如果这条记录就是当前展示中的公告，同步更新 SystemSettings，
 * 让首页公告栏立即生效，避免历史记录与首页展示出现两份不一致的内容。
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录后修改公告')
  }

  if (!canSendSystemNotification(user.role)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.NOTIFICATION_ADMIN_REQUIRED,
      '只有管理员可以修改公告'
    )
  }

  const rawId = parseInt(String(getRouterParam(event, 'id') || ''), 10)
  if (!Number.isFinite(rawId) || rawId <= 0) {
    throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '公告记录不存在')
  }

  const body = await readBody<Record<string, unknown> | null>(event)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const content = typeof body?.content === 'string' ? body.content.trim() : ''

  if (title.length > ANNOUNCEMENT_TITLE_MAX_LENGTH) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      `公告标题不能超过 ${ANNOUNCEMENT_TITLE_MAX_LENGTH} 个字符`
    )
  }
  if (!content) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '公告内容不能为空')
  }
  if (content.length > NOTIFICATION_CONTENT_MAX_LENGTH) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      `公告内容不能超过 ${NOTIFICATION_CONTENT_MAX_LENGTH} 个字符`
    )
  }

  const displayMode = normalizeDisplayMode(body?.displayMode)
  const scrollSpeed = normalizeScrollSpeed(body?.scrollSpeed)

  const [record] = await db
    .select()
    .from(announcementHistory)
    .where(eq(announcementHistory.id, rawId))
    .limit(1)

  if (!record) {
    throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '公告记录不存在')
  }

  await db
    .update(announcementHistory)
    .set({ title: title || null, content, displayMode, scrollSpeed })
    .where(eq(announcementHistory.id, rawId))

  if (record.isActive) {
    const [existing] = await db.select({ id: systemSettings.id }).from(systemSettings).limit(1)
    if (existing) {
      await db
        .update(systemSettings)
        .set({
          announcementTitle: title || null,
          announcement: content,
          announcementDisplayMode: displayMode,
          announcementScrollSpeed: scrollSpeed,
          updatedAt: new Date()
        })
        .where(eq(systemSettings.id, existing.id))
    }
  }

  return {
    success: true,
    announcement: {
      id: rawId,
      title: title || null,
      content,
      displayMode,
      scrollSpeed,
      isActive: record.isActive
    }
  }
})
