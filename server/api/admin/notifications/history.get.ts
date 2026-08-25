import { and, asc, count, desc, eq, ilike, isNotNull, or, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { notifications } from '~/drizzle/schema'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import {
  canSendSystemNotification,
  NOTIFICATION_SOURCES,
  serializeNotificationSender
} from '~~/server/utils/important-notification-policy'
import {
  resolveNotificationHistoryFilters,
  resolveNotificationHistoryPagination
} from '~~/server/utils/notification-history-policy'

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
  const filters = resolveNotificationHistoryFilters({
    keyword: query.keyword,
    type: query.type,
    sender: query.sender,
    sortOrder: query.sortOrder
  })
  if (!filters) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.NOTIFICATION_HISTORY_FILTER_INVALID,
      '通知历史筛选条件无效'
    )
  }

  const { page, limit, offset } = resolveNotificationHistoryPagination(query.page, query.limit)
  const baseCondition = and(
    eq(notifications.type, 'SYSTEM_NOTICE'),
    eq(notifications.source, NOTIFICATION_SOURCES.ADMIN_MANUAL)
  )
  // Drizzle ORM 的 ilike 已对参数做参数化绑定，无需手动转义 % 和 _
  const keywordPattern = filters.keyword ? `%${filters.keyword}%` : null
  const keywordCondition = keywordPattern
    ? or(ilike(notifications.title, keywordPattern), ilike(notifications.message, keywordPattern))
    : undefined
  const typeCondition =
    filters.type === 'IMPORTANT'
      ? eq(notifications.important, true)
      : filters.type === 'NORMAL'
        ? eq(notifications.important, false)
        : undefined
  const senderCondition = filters.senderId
    ? eq(notifications.senderId, filters.senderId)
    : undefined
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
    .where(and(baseCondition, keywordCondition, typeCondition, senderCondition))
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

  const senderName = sql<string | null>`(
    array_agg(${notifications.senderName} order by ${notifications.createdAt} desc)
  )[1]`
  const senderUsername = sql<string | null>`(
    array_agg(${notifications.senderUsername} order by ${notifications.createdAt} desc)
  )[1]`
  const senderOptionsQuery = db
    .select({
      id: notifications.senderId,
      name: senderName.as('sender_name'),
      username: senderUsername.as('sender_username')
    })
    .from(notifications)
    .where(and(baseCondition, isNotNull(notifications.senderId)))
    .groupBy(notifications.senderId)
    .orderBy(asc(notifications.senderId))

  const primarySort =
    filters.sortOrder === 'ASC'
      ? asc(notificationBatches.createdAt)
      : desc(notificationBatches.createdAt)
  const secondarySort =
    filters.sortOrder === 'ASC'
      ? asc(notificationBatches.notificationId)
      : desc(notificationBatches.notificationId)

  try {
    const [historyRows, totalRows, senderRows] = await Promise.all([
      db
        .select()
        .from(notificationBatches)
        .orderBy(primarySort, secondarySort)
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(notificationBatches),
      senderOptionsQuery
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
      senders: senderRows.map((sender) => ({
        id: Number(sender.id),
        name: sender.name,
        username: sender.username
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
