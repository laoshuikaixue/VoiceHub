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
        await cacheService.setSystemSettings(cached).catch(err => console.warn('[SystemSettings] 回填系统设置缓存失败:', err))
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

/**
 * 高效计算是否需要强制改密：通过短路逻辑避免不必要的全局设置查询。
 *
 * 1. 管理员显式 forcePasswordChange=true → 直接返回 true，无需查询全局设置
 * 2. 用户已设置过密码且未被显式强制 → 直接返回 false，无需查询全局设置
 * 3. 仅当用户从未设置过密码时，才异步查询全局开关，并委托 computeRequirePasswordChange 计算最终结果
 *
 * 此函数是全站统一的强制改密判断入口，login.post.ts、verify.get.ts、middleware/auth.ts
 * 均应调用此函数，避免重复编写短路逻辑。
 */
export async function resolveRequirePasswordChange(user: {
  forcePasswordChange?: boolean | null
  passwordChangedAt?: Date | string | null
}): Promise<boolean> {
  if (user.forcePasswordChange) return true
  if (user.passwordChangedAt) return false
  const forcePasswordChangeOnFirstLogin = await getForcePasswordChangeOnFirstLogin()
  return computeRequirePasswordChange(user, forcePasswordChangeOnFirstLogin)
}
