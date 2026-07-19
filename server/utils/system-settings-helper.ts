import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import type { SystemSettings as DBSystemSettings } from '~/drizzle/schema'
import { CacheService } from '~~/server/services/cacheService'

export async function getSystemSettingsCached(): Promise<DBSystemSettings | null> {
  try {
    const cacheService = CacheService.getInstance()
    let settings = await cacheService.getSystemSettings()

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
  const settings = await getSystemSettingsCached()
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
