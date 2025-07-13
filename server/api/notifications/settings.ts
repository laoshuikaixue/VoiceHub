import { prisma } from '../../models/schema'
import type { NotificationSettings, DBNotificationSettings } from '~/types'

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
    let dbSettings: any = await prisma.notificationSettings.findUnique({
      where: {
        userId: user.id
      }
    })
    
    if (!dbSettings) {
      // 创建默认设置
      dbSettings = await prisma.notificationSettings.create({
        data: {
          userId: user.id,
          enabled: true,
          songRequestEnabled: true,
          songVotedEnabled: true,
          songPlayedEnabled: true,
          refreshInterval: 60,
          songVotedThreshold: 1
        }
      })
    }
    
    // 转换为前端期望的格式
    const settings: NotificationSettings = {
      id: dbSettings.id,
      userId: dbSettings.userId,
      songSelectedNotify: dbSettings.songRequestEnabled,
      songPlayedNotify: dbSettings.songPlayedEnabled,
      songVotedNotify: dbSettings.songVotedEnabled,
      systemNotify: dbSettings.enabled,
      refreshInterval: dbSettings.refreshInterval,
      songVotedThreshold: dbSettings.songVotedThreshold
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