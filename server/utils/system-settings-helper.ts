import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import type { SystemSettings } from '~/drizzle/schema'
import { ROLE_PERMISSION_TEMPLATES_DEFAULT } from '~~/app/utils/admin-permissions'
import { validateRoleTemplates } from './permission-policy'
import { createApiError } from './apiError'
import { SERVER_ERROR_CODES } from '../config/constants'

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
 * 未配置时使用内置模板；读取失败时抛错，不恢复已撤销的权限。
 */
export async function getRolePermissionTemplatesCached(
  executor: Pick<typeof db, 'select'> = db
): Promise<Record<string, unknown>> {
  let configured: unknown
  try {
    const [row] = await executor
      .select({ rolePermissionTemplates: systemSettings.rolePermissionTemplates })
      .from(systemSettings)
      .limit(1)
    configured = row?.rolePermissionTemplates
  } catch (error) {
    console.error('[SystemSettings] 读取权限模板失败:', error)
    throw error
  }
  if (configured === null || configured === undefined) {
    return ROLE_PERMISSION_TEMPLATES_DEFAULT
  }
  const result = validateRoleTemplates(configured)
  if (!result.ok) {
    throw createApiError(503, SERVER_ERROR_CODES.AUTH_DATABASE_UNAVAILABLE, '权限配置不可用')
  }
  return result.value
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
