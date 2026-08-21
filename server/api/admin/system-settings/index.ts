import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { maskSystemSettingsSecrets } from '#server/api/admin/system-settings/secretMask'
import { SYSTEM_SETTINGS_DEFAULTS } from '#server/utils/system-settings-defaults'
import { ensureSongQuotaSettingsMigrated } from '#server/utils/system-settings-helper'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能查看系统设置'
    })
  }

  try {
    // 系统设置包含敏感配置，始终从数据库读取。
    const settingsResult = await db.select().from(systemSettings).limit(1)
    let settings = settingsResult[0]

    if (!settings) {
      const newSettingsResult = await db
        .insert(systemSettings)
        .values({
          ...SYSTEM_SETTINGS_DEFAULTS,
          siteTitle: process.env.NUXT_PUBLIC_SITE_TITLE || SYSTEM_SETTINGS_DEFAULTS.siteTitle,
          siteLogoUrl: process.env.NUXT_PUBLIC_SITE_LOGO || SYSTEM_SETTINGS_DEFAULTS.siteLogoUrl,
          siteDescription:
            process.env.NUXT_PUBLIC_SITE_DESCRIPTION || SYSTEM_SETTINGS_DEFAULTS.siteDescription
        })
        .returning()
      settings = newSettingsResult[0]
    } else {
      settings = await ensureSongQuotaSettingsMigrated(settings)
    }

    if (!settings) {
      throw new Error('系统设置初始化失败')
    }
    return maskSystemSettingsSecrets(settings)
  } catch (error) {
    console.error('获取系统设置失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取系统设置失败'
    })
  }
})
