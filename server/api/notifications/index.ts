import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { notifications } from '~/drizzle/schema'
import { eq, desc, and, count } from 'drizzle-orm'

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
    // 获取用户的所有通知
    const userNotifications = await db.select().from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
    
    // 计算未读通知数量
    const unreadCountResult = await db.select({ count: count() }).from(notifications)
      .where(and(
        eq(notifications.userId, user.id),
        eq(notifications.read, false)
      ))
    
    const unreadCount = unreadCountResult[0]?.count || 0
    
    return {
      notifications: userNotifications,
      unreadCount
    }
  } catch (err) {
    console.error('获取通知失败:', err)
    throw createError({
      statusCode: 500,
      message: '获取通知失败'
    })
  }
})