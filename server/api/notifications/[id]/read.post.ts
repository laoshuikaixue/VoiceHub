import { prisma } from '../../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能标记通知'
    })
  }
  
  // 获取通知ID
  const id = parseInt(event.context.params?.id || '0')
  
  if (isNaN(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      message: '无效的通知ID'
    })
  }
  
  try {
    // 检查通知是否属于当前用户
    const notification = await prisma.notification.findUnique({
      where: {
        id: id
      }
    })
    
    if (!notification) {
      throw createError({
        statusCode: 404,
        message: '通知不存在'
      })
    }
    
    if (notification.userId !== user.id) {
      throw createError({
        statusCode: 403,
        message: '无权标记此通知'
      })
    }
    
    // 标记为已读
    const updatedNotification = await prisma.notification.update({
      where: {
        id: id
      },
      data: {
        read: true,
        readAt: new Date()
      }
    })
    
    return updatedNotification
  } catch (err) {
    console.error('标记通知失败:', err)
    throw createError({
      statusCode: 500,
      message: '标记通知失败'
    })
  }
}) 