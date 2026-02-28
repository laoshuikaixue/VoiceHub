import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { cacheService } from '../services/cacheService'
import { isRedisReady } from '../utils/redis'

export default defineEventHandler(async (event) => {
  try {
    // 优先从Redis缓存获取系统设置
    if (isRedisReady()) {
      const cachedSettings = await cacheService.getSystemSettings()
      if (cachedSettings) {
        console.log('[API] 系统设置缓存命中')
        return cachedSettings
      }
    }

    // 缓存未命中或Redis不可用，从数据库获取
    const settingsResult = await db.select().from(systemSettings).limit(1)
    let settings = settingsResult[0] || null

    if (!settings) {
      // 如果不存在，创建默认设置
      const newSettings = await db
        .insert(systemSettings)
        .values({
          enablePlayTimeSelection: false,
          siteTitle: 'VoiceHub',
          siteLogoUrl: '/favicon.ico',
          schoolLogoHomeUrl: null,
          schoolLogoPrintUrl: null,
          siteDescription: '校园广播站点歌系统 - 让你的声音被听见',
          submissionGuidelines: '请遵守校园规定，提交健康向上的歌曲。',
          icpNumber: null,
          enableSubmissionLimit: false,
          dailySubmissionLimit: null,
          weeklySubmissionLimit: null,
          showBlacklistKeywords: false,
          hideStudentInfo: true
        })
        .returning()

      settings = newSettings[0]
    }

    // 过滤敏感字段，只返回公开配置
    const publicFields = [
      'siteTitle',
      'siteLogoUrl',
      'schoolLogoHomeUrl',
      'schoolLogoPrintUrl',
      'siteDescription',
      'submissionGuidelines',
      'icpNumber',
      'enablePlayTimeSelection',
      'enableSubmissionLimit',
      'dailySubmissionLimit',
      'weeklySubmissionLimit',
      'monthlySubmissionLimit',
      'showBlacklistKeywords',
      'hideStudentInfo',
      'enableReplayRequests',
      'enableRequestTimeLimitation',
      'forceBlockAllRequests'
    ]

    const publicSettings = publicFields.reduce((acc: any, key) => {
      if (settings && key in settings) {
        acc[key] = (settings as any)[key]
      }
      return acc
    }, {})

    // 将结果缓存到Redis（如果可用）- 永久缓存
    if (settings && isRedisReady()) {
      await cacheService.setSystemSettings(settings)
      console.log('[API] 系统设置已缓存到Redis')
    }

    return publicSettings
  } catch (error) {
    console.error('获取系统设置失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: '获取系统设置失败'
    })
  }
})
