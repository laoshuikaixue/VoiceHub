import { db } from '~/drizzle/db'

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
    const result = await prisma.notification.deleteMany({
      where: {
        userId: user.id
      }
    })
    
    return {
      success: true,
      count: result.count
    }
  } catch (err) {
    console.error('清空通知失败:', err)
    throw createError({
      statusCode: 500,
      message: '清空通知失败'
    })
  }
}) 