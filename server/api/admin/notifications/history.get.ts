import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { notifications, users } from '~/drizzle/schema'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import { canSendSystemNotification } from '~~/server/utils/important-notification-policy'
import {
  resolveNotificationHistoryPagination,
  resolveNotificationHistoryStatus
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
  const status = resolveNotificationHistoryStatus(query.status)
  if (!status) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.NOTIFICATION_HISTORY_STATUS_INVALID,
      '通知历史状态筛选值无效'
    )
  }

  const { page, limit, offset } = resolveNotificationHistoryPagination(query.page, query.limit)
  const conditions = [eq(notifications.type, 'SYSTEM_NOTICE')]
  if (status === 'READ') conditions.push(eq(notifications.read, true))
  if (status === 'UNREAD') conditions.push(eq(notifications.read, false))
  const whereCondition = and(...conditions)!

  try {
    const [historyRows, totalRows, statsRows] = await Promise.all([
      db
        .select({
          id: notifications.id,
          title: notifications.title,
          message: notifications.message,
          important: notifications.important,
          read: notifications.read,
          createdAt: notifications.createdAt,
          updatedAt: notifications.updatedAt,
          userId: notifications.userId,
          username: users.username,
          userName: users.name,
          grade: users.grade,
          className: users.class
        })
        .from(notifications)
        .leftJoin(users, eq(notifications.userId, users.id))
        .where(whereCondition)
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(notifications).where(whereCondition),
      db
        .select({ read: notifications.read, count: count() })
        .from(notifications)
        .where(eq(notifications.type, 'SYSTEM_NOTICE'))
        .groupBy(notifications.read)
    ])

    const stats = { total: 0, read: 0, unread: 0 }
    for (const row of statsRows) {
      const value = Number(row.count || 0)
      stats.total += value
      if (row.read) stats.read = value
      else stats.unread = value
    }

    const total = Number(totalRows[0]?.count || 0)
    return {
      notifications: historyRows.map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        important: row.important,
        read: row.read,
        createdAt: row.createdAt,
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
  } catch (error) {
    console.error('获取通知历史失败:', error)
    throw createApiError(
      500,
      SERVER_ERROR_CODES.NOTIFICATION_HISTORY_FETCH_FAILED,
      '获取通知历史失败'
    )
  }
})
