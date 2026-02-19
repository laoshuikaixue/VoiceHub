import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { CacheService } from '../../../services/cacheService'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能查看系统设置'
    })
  }

  try {
    // 尝试从缓存获取系统设置
    const cacheService = CacheService.getInstance()
    let settings = await cacheService.getSystemSettings()

    if (settings) {
      return settings
    }

    // 缓存中没有，从数据库获取系统设置，如果不存在则创建默认设置
    const settingsResult = await db.select().from(systemSettings).limit(1)
    settings = settingsResult[0]

    if (!settings) {
      const newSettingsResult = await db
        .insert(systemSettings)
        .values({
          enablePlayTimeSelection: false,
          siteTitle: process.env.NUXT_PUBLIC_SITE_TITLE || 'VoiceHub',
          siteLogoUrl: process.env.NUXT_PUBLIC_SITE_LOGO || '/favicon.ico',
          schoolLogoHomeUrl: null,
          schoolLogoPrintUrl: null,
          siteDescription:
            process.env.NUXT_PUBLIC_SITE_DESCRIPTION || '校园广播站点歌系统 - 让你的声音被听见',
          submissionGuidelines: '请遵守校园规定，提交健康向上的歌曲。',
          icpNumber: null,
          enableSubmissionLimit: false,
          dailySubmissionLimit: null,
          weeklySubmissionLimit: null,
          showBlacklistKeywords: false
        })
        .returning()
      settings = newSettingsResult[0]
    }

    // 将设置存入缓存
    try {
      await cacheService.setSystemSettings(settings)
    } catch (cacheError) {
      console.warn('缓存系统设置失败:', cacheError)
    }

    return settings
  } catch (error) {
    console.error('获取系统设置失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取系统设置失败'
    })
  }
})
