import { prisma } from '../../models/schema'

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
    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    // 计算未读通知数量
    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        read: false
      }
    })
    
    return {
      notifications,
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