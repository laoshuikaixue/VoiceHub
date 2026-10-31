import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import type { SystemSettings } from '~/drizzle/schema'
import { ROLE_PERMISSION_TEMPLATES_DEFAULT } from '~~/app/utils/admin-permissions'

/**
 * 统一读取系统设置，读取失败时返回 null，由调用方按安全默认值降级。
 * 说明：随主分支 minimize-Redis 重构，此处直接查询数据库，不再经过缓存层。
 */
export async function getSystemSettingsCached(): Promise<SystemSettings | null> {
  try {
    const [settings] = await db.select().from(systemSettings).limit(1)
    return settings ?? null
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

/**
 * 角色权限模板：配置缺失、类型非法或角色缺省时回落到代码内置模板，
 * 保证权限读取故障不会把管理员锁在后台之外。
 */
export async function getRolePermissionTemplatesCached(): Promise<Record<string, unknown>> {
  const settings = await getSystemSettingsCached()
  const configured = settings?.rolePermissionTemplates
  if (!configured || typeof configured !== 'object' || Array.isArray(configured)) {
    return ROLE_PERMISSION_TEMPLATES_DEFAULT
  }
  return configured as Record<string, unknown>
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
