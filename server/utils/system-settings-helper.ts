import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import type { SystemSettings } from '~/drizzle/schema'
import { CacheService } from '../services/cacheService'

/**
 * 统一缓存读取可避免各业务接口重复穿透数据库，缓存故障时仍允许从数据库恢复。
 */
export async function getSystemSettingsCached(): Promise<SystemSettings | null> {
  try {
    const cacheService = CacheService.getInstance()
    const cached = await cacheService.getSystemSettings()
    if (cached) return cached

    const [settings] = await db.select().from(systemSettings).limit(1)
    if (!settings) return null

    void cacheService
      .setSystemSettings(settings)
      .catch(error => console.warn('[SystemSettings] 回填系统设置缓存失败:', error))
    return settings
  } catch (error) {
    console.warn('[SystemSettings] 读取系统设置失败:', error)
    return null
  }
}
