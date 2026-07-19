import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { cacheService } from '../services/cacheService'
import { SYSTEM_SETTINGS_DEFAULTS, filterPublicSettings } from '../utils/system-settings-defaults'
import { getInstanceId } from '../utils/instance-id'

export default defineEventHandler(async (event) => {
  try {
    // 优先读取内存或 Redis 缓存，避免认证中间件在 Redis 不可用时反复查询数据库。
    const cachedSettings = await cacheService.getSystemSettings()
    if (cachedSettings) {
      console.log('[API] 系统设置缓存命中')
      return filterPublicSettings(cachedSettings)
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

    // Ensure instance ID is set after defaults are applied and merge into settings
    const instanceId = await getInstanceId()
    if (instanceId && settings) {
      settings.instanceId = instanceId
    }

    const publicSettings = filterPublicSettings(settings)

    // 缓存服务自行选择内存或 Redis，确保没有 Redis 时仍能复用设置。
    if (settings) {
      await cacheService.setSystemSettings(settings)
      console.log('[API] 系统设置已缓存')
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
