import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import type { SystemSettings as DBSystemSettings } from '~/drizzle/schema'
import { CacheService } from '~~/server/services/cacheService'

export async function getSystemSettingsCached(
  options: { requireSharedConsistency?: boolean } = {}
): Promise<DBSystemSettings | null> {
  try {
    if (options.requireSharedConsistency) {
      const result = await db.select().from(systemSettings).limit(1)
      return result[0] || null
    }

    const cacheService = CacheService.getInstance()
    let settings = await cacheService.getSystemSettings({
      // 无 Redis 的多实例部署不能把进程内缓存作为安全策略的数据源。
      allowMemoryFallback: !options.requireSharedConsistency
    })

    if (!settings) {
      const result = await db.select().from(systemSettings).limit(1)
      settings = result[0] || null
      if (settings) {
        void cacheService.setSystemSettings(settings).catch((error) => {
          console.warn('[SystemSettings] 回填缓存失败:', error)
        })
      }
    }

    return settings
  } catch (error) {
    console.warn('[SystemSettings] 读取系统设置失败:', error)
    return null
  }
}

export async function getForcePasswordChangeOnFirstLogin(): Promise<boolean> {
  // 强制改密是安全策略，不能把 Redis 作为唯一事实来源；每次从数据库读取以避免多实例旧缓存。
  const settings = await getSystemSettingsCached({ requireSharedConsistency: true })
  return settings && typeof settings.forcePasswordChangeOnFirstLogin === 'boolean'
    ? settings.forcePasswordChangeOnFirstLogin
    : false
}

export function computeRequirePasswordChange(
  user: { forcePasswordChange?: boolean | null; passwordChangedAt?: Date | string | null },
  forcePasswordChangeOnFirstLogin: boolean
): boolean {
  return !!user.forcePasswordChange || (forcePasswordChangeOnFirstLogin && !user.passwordChangedAt)
}

export async function resolveRequirePasswordChange(user: {
  forcePasswordChange?: boolean | null
  passwordChangedAt?: Date | string | null
}): Promise<boolean> {
  if (user.forcePasswordChange) return true
  if (user.passwordChangedAt) return false
  return computeRequirePasswordChange(user, await getForcePasswordChangeOnFirstLogin())
}
