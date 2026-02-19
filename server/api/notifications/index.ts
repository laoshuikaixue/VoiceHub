import { and, count, desc, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { notifications, songCollaborators, songs } from '~/drizzle/schema'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能获取通知'
    })
  }

  try {
    // 获取查询参数
    const query = getQuery(event)
    const page = Math.max(1, parseInt(query.page as string) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 10))
    const offset = (page - 1) * limit

    // 获取总通知数量
    const totalCountResult = await db
      .select({ count: count() })
      .from(notifications)
      .where(eq(notifications.userId, user.id))
    const totalCount = totalCountResult[0]?.count || 0
    const totalPages = Math.ceil(totalCount / limit)

    // 获取分页通知数据
    const userNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset)

    // 丰富通知数据，特别是对于联合投稿邀请
    const enrichedNotifications = await Promise.all(
      userNotifications.map(async (notification) => {
        if (notification.type === 'COLLABORATION_INVITE' && notification.songId) {
          // 1. 检查歌曲是否存在
          const songExists = await db
            .select({ id: songs.id })
            .from(songs)
            .where(eq(songs.id, notification.songId))
            .limit(1)
            .then((res) => res.length > 0)

          if (!songExists) {
            return {
              ...notification,
              handled: true,
              status: 'INVALID',
              isValid: false,
              message: notification.message // 保持原消息，前端会显示已失效
            }
          }

          // 2. 查询对应的邀请状态
          const collab = await db
            .select()
            .from(songCollaborators)
            .where(
              and(
                eq(songCollaborators.songId, notification.songId),
                eq(songCollaborators.userId, user.id)
              )
            )
            .limit(1)

          if (collab.length > 0) {
            return {
              ...notification,
              handled: collab[0].status !== 'PENDING',
              status: collab[0].status,
              isValid: true,
              repliedAt: collab[0].updatedAt || collab[0].createdAt // 假设更新时间为回复时间
            }
          } else {
            // 如果找不到邀请记录，说明可能已经被撤回或删除
            return {
              ...notification,
              handled: true,
              status: 'INVALID',
              isValid: false,
              message: notification.message
            }
          }
        }
        return {
          ...notification,
          handled: false, // 默认未处理，或者不适用
          isValid: true
        }
      })
    )

    // 计算未读通知数量
    const unreadCountResult = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)))

    const unreadCount = unreadCountResult[0]?.count || 0

    return {
      notifications: enrichedNotifications,
      unreadCount,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  } catch (err) {
    console.error('获取通知失败:', err)
    throw createError({
      statusCode: 500,
      message: '获取通知失败'
    })
  }
})
