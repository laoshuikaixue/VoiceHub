import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { SYSTEM_SETTINGS_DEFAULTS, filterPublicSettings } from '../utils/system-settings-defaults'
import { getInstanceId } from '../utils/instance-id'

export default defineEventHandler(async (event) => {
  try {
    const settingsResult = await db.select().from(systemSettings).limit(1)
    let settings = settingsResult[0] || null

    if (!settings) {
      const newSettings = await db
        .insert(systemSettings)
        .values(SYSTEM_SETTINGS_DEFAULTS)
        .returning()

      settings = newSettings[0]
    }

    // Ensure instance ID is set after defaults are applied and merge into settings
    const instanceId = await getInstanceId()
    if (instanceId && settings) {
      settings.instanceId = instanceId
    }

    const publicSettings = filterPublicSettings(settings)

    return publicSettings
  } catch (error) {
    console.error('获取系统设置失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取系统设置失败'
    })
  }
})
