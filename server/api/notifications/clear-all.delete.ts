import { db } from '~/drizzle/db'
import { notifications } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能清空通知'
    })
  }

  try {
    // 删除该用户的所有通知
    const result = await db.delete(notifications).where(eq(notifications.userId, user.id))

    return {
      success: true,
      count: result.rowCount || 0
    }
  } catch (err) {
    console.error('清空通知失败:', err)
    throw createError({
      statusCode: 500,
      message: '清空通知失败'
    })
  }
})
