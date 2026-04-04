import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { cacheService } from '../services/cacheService'
import { isRedisReady } from '../utils/redis'
import { SYSTEM_SETTINGS_DEFAULTS, filterPublicSettings } from '../utils/system-settings-defaults'

export default defineEventHandler(async (event) => {
  try {
    // 优先从Redis缓存获取系统设置
    if (isRedisReady()) {
      const cachedSettings = await cacheService.getSystemSettings()
      if (cachedSettings) {
        console.log('[API] 系统设置缓存命中')
        return filterPublicSettings(cachedSettings)
      }
    }

    // 缓存未命中或Redis不可用，从数据库获取
    const settingsResult = await db.select().from(systemSettings).limit(1)
    let settings = settingsResult[0] || null

    if (!settings) {
      const newSettings = await db
        .insert(systemSettings)
        .values(SYSTEM_SETTINGS_DEFAULTS)
        .returning()

      settings = newSettings[0]
    }

    const publicSettings = filterPublicSettings(settings)

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
      message: '获取系统设置失败'
    })
  }
})
