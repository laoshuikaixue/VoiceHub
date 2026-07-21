import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'

export async function getForcePasswordChangeOnFirstLogin(): Promise<boolean> {
  try {
    const [settings] = await db
      .select({
        forcePasswordChangeOnFirstLogin: systemSettings.forcePasswordChangeOnFirstLogin
      })
      .from(systemSettings)
      .limit(1)

    return settings?.forcePasswordChangeOnFirstLogin ?? false
  } catch (error) {
    // 配置依赖故障时降级放行，避免认证中间件阻断全站请求。
    console.error('[SystemSettings] 读取首次登录强制改密设置失败，已降级放行:', error)
    return false
  }
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
