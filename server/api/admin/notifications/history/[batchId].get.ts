import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { notifications, users } from '~/drizzle/schema'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import {
  canSendSystemNotification,
  NOTIFICATION_SOURCES,
  serializeNotificationSender
} from '~~/server/utils/important-notification-policy'
import {
  resolveNotificationBatchReference,
  resolveNotificationHistoryPagination,
  resolveNotificationHistoryStatus
} from '~~/server/utils/notification-history-policy'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(
      401,
      SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED,
      '请先登录后查看通知明细'
    )
  }

  if (!canSendSystemNotification(user.role)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.NOTIFICATION_ADMIN_REQUIRED,
      '只有管理员可以查看通知明细'
    )
  }

  const batchReference = resolveNotificationBatchReference(getRouterParam(event, 'batchId'))
  if (!batchReference) {
    throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '通知不存在')
  }

  const query = getQuery(event)
  const status = resolveNotificationHistoryStatus(query.status)
  if (!status) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.NOTIFICATION_HISTORY_STATUS_INVALID,
      '通知历史状态筛选值无效'
    )
  }

  const { page, limit, offset } = resolveNotificationHistoryPagination(query.page, query.limit)
  const batchCondition = batchReference.batchId
    ? eq(notifications.batchId, batchReference.batchId)
    : eq(notifications.id, batchReference.notificationId!)
  const baseCondition = and(
    eq(notifications.type, 'SYSTEM_NOTICE'),
    eq(notifications.source, NOTIFICATION_SOURCES.ADMIN_MANUAL),
    batchCondition
  )!
  const filteredConditions = [baseCondition]
  if (status === 'READ') filteredConditions.push(eq(notifications.read, true))
  if (status === 'UNREAD') filteredConditions.push(eq(notifications.read, false))
  const filteredCondition = and(...filteredConditions)!

  let queryResult

  try {
    queryResult = await Promise.all([
      db
        .select({
          id: notifications.id,
          read: notifications.read,
          updatedAt: notifications.updatedAt,
          userId: notifications.userId,
          username: users.username,
          userName: users.name,
          grade: users.grade,
          className: users.class
        })
        .from(notifications)
        .leftJoin(users, eq(notifications.userId, users.id))
        .where(filteredCondition)
        .orderBy(desc(notifications.id))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(notifications).where(filteredCondition),
      db
        .select({ read: notifications.read, count: count() })
        .from(notifications)
        .where(baseCondition)
        .groupBy(notifications.read),
      db
        .select({
          title: notifications.title,
          message: notifications.message,
          important: notifications.important,
          senderId: notifications.senderId,
          senderName: notifications.senderName,
          senderUsername: notifications.senderUsername,
          createdAt: notifications.createdAt
        })
        .from(notifications)
        .where(baseCondition)
        .limit(1)
    ])
  } catch (error) {
    console.error('获取通知明细失败:', error)
    throw createApiError(
      500,
      SERVER_ERROR_CODES.NOTIFICATION_HISTORY_FETCH_FAILED,
      '获取通知明细失败'
    )
  }

  const [detailRows, totalRows, statsRows, metadataRows] = queryResult

  const metadata = metadataRows[0]
  if (!metadata) {
    throw createApiError(404, SERVER_ERROR_CODES.NOTIFICATION_NOT_FOUND, '通知不存在')
  }

  const stats = { total: 0, read: 0, unread: 0 }
  for (const row of statsRows) {
    const value = Number(row.count || 0)
    stats.total += value
    if (row.read) stats.read = value
    else stats.unread = value
  }

  const total = Number(totalRows[0]?.count || 0)
  const { senderId, senderName, senderUsername, ...notificationMetadata } = metadata
  return {
    notification: {
      batchId: getRouterParam(event, 'batchId'),
      ...notificationMetadata,
      sender: serializeNotificationSender({ senderId, senderName, senderUsername })
    },
    recipients: detailRows.map((row) => ({
      id: row.id,
      read: row.read,
      readAt: row.read ? row.updatedAt : null,
      recipient: {
        id: row.userId,
        username: row.username,
        name: row.userName,
        grade: row.grade,
        class: row.className
      }
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    },
    stats
  }
})
