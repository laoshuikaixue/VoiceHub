import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import type { SystemSettings } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { migrateLegacyQuotaSettings } from '~~/server/utils/song-quota-policy'

export async function ensureSongQuotaSettingsMigrated(
  settings: SystemSettings
): Promise<SystemSettings> {
  if (settings.songQuotaEnabled !== null) return settings

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.id, settings.id))
      .limit(1)
      .for('update')
    if (!current) return settings
    if (current.songQuotaEnabled !== null) return current

    const [migrated] = await tx
      .update(systemSettings)
      .set(migrateLegacyQuotaSettings(current))
      .where(eq(systemSettings.id, current.id))
      .returning()
    return migrated ?? current
  })
}

export async function getSystemSettingsCached(): Promise<SystemSettings | null> {
  try {
    const [settings] = await db.select().from(systemSettings).limit(1)
    return settings ? ensureSongQuotaSettingsMigrated(settings) : null
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
