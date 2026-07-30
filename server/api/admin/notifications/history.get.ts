import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { notifications } from '~/drizzle/schema'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import {
  canSendSystemNotification,
  NOTIFICATION_SOURCES,
  serializeNotificationSender
} from '~~/server/utils/important-notification-policy'
import { resolveNotificationHistoryPagination } from '~~/server/utils/notification-history-policy'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(
      401,
      SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED,
      '请先登录后查看通知历史'
    )
  }

  if (!canSendSystemNotification(user.role)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.NOTIFICATION_ADMIN_REQUIRED,
      '只有管理员可以查看通知历史'
    )
  }

  const query = getQuery(event)
  const { page, limit, offset } = resolveNotificationHistoryPagination(query.page, query.limit)
  const batchKey = sql<string>`coalesce(
    ${notifications.batchId},
    'legacy-' || cast(${notifications.id} as text)
  )`

  const notificationBatches = db
    .select({
      batchId: batchKey.as('batch_id'),
      notificationId: sql<number>`max(${notifications.id})`.as('notification_id'),
      title: notifications.title,
      message: notifications.message,
      important: notifications.important,
      senderId: notifications.senderId,
      senderName: notifications.senderName,
      senderUsername: notifications.senderUsername,
      createdAt: notifications.createdAt,
      recipientCount: count().as('recipient_count')
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.type, 'SYSTEM_NOTICE'),
        eq(notifications.source, NOTIFICATION_SOURCES.ADMIN_MANUAL)
      )
    )
    .groupBy(
      batchKey,
      notifications.title,
      notifications.message,
      notifications.important,
      notifications.senderId,
      notifications.senderName,
      notifications.senderUsername,
      notifications.createdAt
    )
    .as('notification_batches')

  try {
    const [historyRows, totalRows] = await Promise.all([
      db
        .select()
        .from(notificationBatches)
        .orderBy(desc(notificationBatches.createdAt), desc(notificationBatches.notificationId))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(notificationBatches)
    ])

    const total = Number(totalRows[0]?.count || 0)
    return {
      notifications: historyRows.map((row) => ({
        batchId: row.batchId,
        title: row.title,
        message: row.message,
        important: row.important,
        sender: serializeNotificationSender({
          senderId: row.senderId,
          senderName: row.senderName,
          senderUsername: row.senderUsername
        }),
        createdAt: row.createdAt,
        recipientCount: Number(row.recipientCount || 0)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    }
  } catch (error) {
    console.error('获取通知历史失败:', error)
    throw createApiError(
      500,
      SERVER_ERROR_CODES.NOTIFICATION_HISTORY_FETCH_FAILED,
      '获取通知历史失败'
    )
  }
})
