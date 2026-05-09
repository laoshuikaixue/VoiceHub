import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import type { SystemSettings as DBSystemSettings } from '~/drizzle/schema'
import { CacheService } from '../services/cacheService'

/**
 * 获取系统设置（优先使用 Redis 缓存，缓存未命中时从数据库加载并回填）
 *
 * 该工具被多处认证/中间件代码使用，统一封装可避免重复代码并保证一致的降级策略。
 *
 * @returns 系统设置对象，若读取失败则返回 null
 */
export async function getSystemSettingsCached(): Promise<DBSystemSettings | null> {
  try {
    const cacheService = CacheService.getInstance()
    let cached = await cacheService.getSystemSettings()

    if (!cached) {
      const result = await db.select().from(systemSettings).limit(1)
      if (result[0]) {
        cached = result[0]
        // 静默回填缓存，失败不影响主流程
        await cacheService.setSystemSettings(cached).catch(() => {})
      }
    }

    return cached || null
  } catch (e) {
    console.warn('[SystemSettings] 读取系统设置失败:', e)
    return null
  }
}

/**
 * 获取"首次登录强制改密"全局开关。
 * 任何异常情况下默认返回 true（保守策略，确保安全性）。
 */
export async function getForcePasswordChangeOnFirstLogin(): Promise<boolean> {
  const settings = await getSystemSettingsCached()
  if (settings) {
    return settings.forcePasswordChangeOnFirstLogin
  }
  return true
}

/**
 * 根据用户字段与全局设置计算是否需要强制改密。
 * 管理员显式标志（forcePasswordChange=true）始终具有最高优先级。
 */
export function computeRequirePasswordChange(
  user: { forcePasswordChange?: boolean | null; passwordChangedAt?: Date | string | null },
  forcePasswordChangeOnFirstLogin: boolean
): boolean {
  return !!user.forcePasswordChange || (forcePasswordChangeOnFirstLogin && !user.passwordChangedAt)
}
