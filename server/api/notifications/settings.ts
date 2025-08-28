import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { users, notificationSettings } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
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
    // 获取用户信息（包含meowNickname）
    const userInfoResult = await db.select({
      meowNickname: users.meowNickname
    }).from(users).where(eq(users.id, user.id)).limit(1)
    
    const userInfo = userInfoResult[0]

    // 获取用户的通知设置，如果不存在则创建默认设置
    const dbSettingsResult = await db.select().from(notificationSettings)
      .where(eq(notificationSettings.userId, user.id)).limit(1)
    
    let dbSettings: any = dbSettingsResult[0]
    
    if (!dbSettings) {
      // 创建默认设置
      const insertResult = await db.insert(notificationSettings).values({
        userId: user.id,
        enabled: true,
        songRequestEnabled: true,
        songVotedEnabled: true,
        songPlayedEnabled: true,
        refreshInterval: 60,
        songVotedThreshold: 1
      }).returning()
      
      dbSettings = insertResult[0]
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
      songVotedThreshold: dbSettings.songVotedThreshold,
      meowUserId: userInfo?.meowNickname || ''
    }
    
    return {
      success: true,
      data: settings
    }
  } catch (err) {
    console.error('获取通知设置失败:', err)
    throw createError({
      statusCode: 500,
      message: '获取通知设置失败'
    })
  }
})