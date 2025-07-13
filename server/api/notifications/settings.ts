import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能获取通知设置'
    })
  }
  
  try {
    // 获取用户的通知设置，如果不存在则创建默认设置
    let settings = await prisma.notificationSettings.findUnique({
      where: {
        userId: user.id
      }
    })
    
    if (!settings) {
      // 创建默认设置
      settings = await prisma.notificationSettings.create({
        data: {
          userId: user.id,
          songSelectedNotify: true,
          songPlayedNotify: true,
          songVotedNotify: true,
          systemNotify: true
        }
      })
    }
    
    return settings
  } catch (err) {
    console.error('获取通知设置失败:', err)
    throw createError({
      statusCode: 500,
      message: '获取通知设置失败'
    })
  }
}) 