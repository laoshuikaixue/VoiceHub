import { and, db, eq, notifications } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能标记通知'
    })
  }

  try {
    // 标记该用户的所有未读通知为已读
    const result = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)))

    return {
      success: true,
      count: result.count
    }
  } catch (err) {
    console.error('标记所有通知失败:', err)
    throw createError({
      statusCode: 500,
      message: '标记所有通知失败'
    })
  }
})
