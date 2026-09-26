import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { SYSTEM_SETTINGS_DEFAULTS, filterPublicSettings } from '../utils/system-settings-defaults'
import { getInstanceId } from '../utils/instance-id'
import { computeLegalConsentVersion } from '../utils/legal-consent'

export default defineEventHandler(async (event) => {
  try {
    const settingsResult = await db.select().from(systemSettings).limit(1)
    let settings = settingsResult[0] || null

    if (!settings) {
      const newSettings = await db
        .insert(systemSettings)
        .values(SYSTEM_SETTINGS_DEFAULTS)
        .returning()

      settings = newSettings[0] || null
    }

    if (!settings) {
      throw new Error('系统设置初始化失败')
    }

    // Ensure instance ID is set after defaults are applied and merge into settings
    const instanceId = await getInstanceId()
    if (instanceId && settings) {
      settings.instanceId = instanceId
    }

    const publicSettings = filterPublicSettings(settings)

    // 条款内容版本指纹为派生值（非数据库列），供登录页按内容变化判定是否需重新同意
    if (publicSettings.legalConsentEnabled) {
      publicSettings.legalConsentVersion = computeLegalConsentVersion(settings) || ''
    }

    return publicSettings
  } catch (error) {
    console.error('获取系统设置失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取系统设置失败'
    })
  }
})
