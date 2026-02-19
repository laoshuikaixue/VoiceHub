import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { notificationSettings, users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

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
    // 获取用户信息（包含meowNickname和邮箱信息）
    const userInfoResult = await db
      .select({
        meowNickname: users.meowNickname,
        email: users.email,
        emailVerified: users.emailVerified
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)

    const userInfo = userInfoResult[0]

    // 获取用户的通知设置，如果不存在则创建默认设置
    const dbSettingsResult = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, user.id))
      .limit(1)

    let dbSettings: any = dbSettingsResult[0]

    if (!dbSettings) {
      // 创建默认设置
      const insertResult = await db
        .insert(notificationSettings)
        .values({
          userId: user.id,
          enabled: true,
          songRequestEnabled: true,
          songVotedEnabled: true,
          songPlayedEnabled: true,
          refreshInterval: 60,
          songVotedThreshold: 1
        })
        .returning()

      dbSettings = insertResult[0]
    }

    // 转换为前端期望的格式（包含用户邮箱状态）
    const settings = {
      id: dbSettings.id,
      userId: dbSettings.userId,
      songSelectedNotify: dbSettings.songRequestEnabled,
      songPlayedNotify: dbSettings.songPlayedEnabled,
      songVotedNotify: dbSettings.songVotedEnabled,
      systemNotify: dbSettings.enabled,
      refreshInterval: dbSettings.refreshInterval,
      songVotedThreshold: dbSettings.songVotedThreshold,
      meowUserId: userInfo?.meowNickname || '',
      // 邮件通知总开关移除：以邮箱绑定状态为准
      // 用户邮箱信息
      userEmail: userInfo?.email || '',
      emailVerified: userInfo?.emailVerified || false
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
