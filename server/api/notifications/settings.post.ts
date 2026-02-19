import { db } from '~/drizzle/db'
import { notificationSettings } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import type { NotificationSettings } from '~/types'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能更新通知设置'
    })
  }

  const body = await readBody(event)

  // 验证请求体
  if (typeof body !== 'object' || body === null) {
    throw createError({
      statusCode: 400,
      message: '无效的请求数据'
    })
  }

  try {
    // 获取用户当前的通知设置
    const existingSettingsResult = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, user.id))
      .limit(1)
    let dbSettings: any = existingSettingsResult[0]

    if (dbSettings) {
      // 更新现有设置
      const updatedSettingsResult = await db
        .update(notificationSettings)
        .set({
          enabled: body.systemNotify !== undefined ? body.systemNotify : dbSettings.enabled,
          songRequestEnabled:
            body.songSelectedNotify !== undefined
              ? body.songSelectedNotify
              : dbSettings.songRequestEnabled,
          songPlayedEnabled:
            body.songPlayedNotify !== undefined
              ? body.songPlayedNotify
              : dbSettings.songPlayedEnabled,
          songVotedEnabled:
            body.songVotedNotify !== undefined ? body.songVotedNotify : dbSettings.songVotedEnabled,
          songVotedThreshold:
            body.songVotedThreshold !== undefined
              ? Math.max(1, Math.min(10, body.songVotedThreshold))
              : dbSettings.songVotedThreshold,
          refreshInterval:
            body.refreshInterval !== undefined
              ? Math.max(10, Math.min(300, body.refreshInterval))
              : dbSettings.refreshInterval
          // 邮件通知总开关移除
        })
        .where(eq(notificationSettings.userId, user.id))
        .returning()
      dbSettings = updatedSettingsResult[0]
    } else {
      // 创建新设置
      const newSettingsResult = await db
        .insert(notificationSettings)
        .values({
          userId: user.id,
          enabled: body.systemNotify !== undefined ? body.systemNotify : true,
          songRequestEnabled:
            body.songSelectedNotify !== undefined ? body.songSelectedNotify : true,
          songPlayedEnabled: body.songPlayedNotify !== undefined ? body.songPlayedNotify : true,
          songVotedEnabled: body.songVotedNotify !== undefined ? body.songVotedNotify : true,
          songVotedThreshold:
            body.songVotedThreshold !== undefined
              ? Math.max(1, Math.min(10, body.songVotedThreshold))
              : 1,
          refreshInterval:
            body.refreshInterval !== undefined
              ? Math.max(10, Math.min(300, body.refreshInterval))
              : 60
        })
        .returning()
      dbSettings = newSettingsResult[0]
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

    return {
      success: true,
      data: settings,
      message: '通知设置保存成功'
    }
  } catch (err) {
    console.error('更新通知设置失败:', err)
    throw createError({
      statusCode: 500,
      message: '更新通知设置失败'
    })
  }
})
