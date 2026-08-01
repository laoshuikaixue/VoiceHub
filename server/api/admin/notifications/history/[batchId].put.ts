import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '~/drizzle/db'
import { notifications } from '~/drizzle/schema'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import {
  canSendSystemNotification,
  createNotificationSenderSnapshot,
  NOTIFICATION_SOURCES,
  NOTIFICATION_CONTENT_MAX_LENGTH,
  NOTIFICATION_TITLE_MAX_LENGTH,
  resolveImportantFlag,
  serializeNotificationSender
} from '~~/server/utils/important-notification-policy'
import { resolveNotificationBatchReference } from '~~/server/utils/notification-history-policy'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录后修改通知')
  }

  if (!canSendSystemNotification(user.role)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.NOTIFICATION_ADMIN_REQUIRED,
      '只有管理员可以修改通知'
    )
  }

  const batchReference = resolveNotificationBatchReference(getRouterParam(event, 'batchId'))
  if (!batchReference) {
    throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '通知不存在')
  }

  const body = await readBody<Record<string, unknown> | null>(event)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const rawContent = typeof body?.content === 'string' ? body.content : body?.message
  const content = typeof rawContent === 'string' ? rawContent.trim() : ''
  const important = resolveImportantFlag(body?.important)

  if (important === null) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.NOTIFICATION_IMPORTANT_INVALID,
      '重要通知标记必须是布尔值'
    )
  }

  if (!title || !content) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.NOTIFICATION_TITLE_CONTENT_REQUIRED,
      '通知标题和内容不能为空'
    )
  }

  if (title.length > NOTIFICATION_TITLE_MAX_LENGTH) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.NOTIFICATION_TITLE_TOO_LONG,
      `通知标题不能超过 ${NOTIFICATION_TITLE_MAX_LENGTH} 个字符`,
      { params: [NOTIFICATION_TITLE_MAX_LENGTH] }
    )
  }

  if (content.length > NOTIFICATION_CONTENT_MAX_LENGTH) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.NOTIFICATION_CONTENT_TOO_LONG,
      `通知正文不能超过 ${NOTIFICATION_CONTENT_MAX_LENGTH} 个字符`,
      { params: [NOTIFICATION_CONTENT_MAX_LENGTH] }
    )
  }

  const batchCondition = batchReference.batchId
    ? eq(notifications.batchId, batchReference.batchId)
    : eq(notifications.id, batchReference.notificationId!)
  const baseCondition = and(
    eq(notifications.type, 'SYSTEM_NOTICE'),
    eq(notifications.source, NOTIFICATION_SOURCES.ADMIN_MANUAL),
    batchCondition
  )!

  if (important) {
    try {
      const batchId = randomUUID()
      const createdAt = new Date()
      const senderSnapshot = createNotificationSenderSnapshot({
        id: user.id,
        name: user.name,
        username: user.username
      })

      // 同一事务内删除旧批次并重新下发，避免旧内容继续弹窗、历史列表残留重复记录
      const recipientUserIds = await db.transaction(async (tx) => {
        const recipients = await tx
          .delete(notifications)
          .where(baseCondition)
          .returning({ userId: notifications.userId })

        if (recipients.length === 0) {
          return []
        }

        const userIds = [...new Set(recipients.map(({ userId }) => userId))]
        await tx.insert(notifications).values(
          userIds.map((userId) => ({
            userId,
            type: 'SYSTEM_NOTICE',
            batchId,
            source: NOTIFICATION_SOURCES.ADMIN_MANUAL,
            ...senderSnapshot,
            title,
            message: content,
            important: true,
            read: false,
            userDeleted: false,
            createdAt,
            updatedAt: createdAt
          }))
        )
        return userIds
      })

      if (recipientUserIds.length === 0) {
        throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '通知不存在')
      }

      return {
        success: true,
        createdNewBatch: true,
        updatedCount: recipientUserIds.length,
        notification: {
          batchId,
          title,
          message: content,
          important: true,
          sender: serializeNotificationSender(senderSnapshot),
          createdAt,
          recipientCount: recipientUserIds.length
        }
      }
    } catch (error) {
      if (typeof error === 'object' && error && 'statusCode' in error) throw error
      console.error('重新发送重要通知失败:', error)
      throw createApiError(
        500,
        SERVER_ERROR_CODES.NOTIFICATION_HISTORY_UPDATE_FAILED,
        '修改通知失败'
      )
    }
  }

  let updatedRows
  try {
    updatedRows = await db
      .update(notifications)
      .set({ title, message: content, important: false })
      .where(baseCondition)
      .returning({ id: notifications.id })
  } catch (error) {
    console.error('修改通知失败:', error)
    throw createApiError(
      500,
      SERVER_ERROR_CODES.NOTIFICATION_HISTORY_UPDATE_FAILED,
      '修改通知失败'
    )
  }

  if (updatedRows.length === 0) {
    throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '通知不存在')
  }

  return {
    success: true,
    updatedCount: updatedRows.length,
    notification: { title, message: content, important }
  }
})
