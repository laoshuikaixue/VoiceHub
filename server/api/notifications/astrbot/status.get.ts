import { defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindings } from '~/drizzle/schema'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { ASTRBOT_PLATFORMS, isAstrbotPlatformEnabled } from '~~/server/utils/astrbot-platforms'
import { formatDateTime } from '~/utils/timeUtils'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录')
  const rows = await db.select().from(astrbotBindings).where(eq(astrbotBindings.userId, user.id))
  const settings = await getSystemSettingsCached()
  return {
    success: true,
    enabled: !!settings?.astrbotEnabled,
    platforms: Object.fromEntries(ASTRBOT_PLATFORMS.map((platform) => {
      const row = rows.find((item) => item.platform === platform)
      return [platform, {
        enabled: !!settings?.astrbotEnabled && isAstrbotPlatformEnabled(settings.astrbotPlatforms, platform),
        bound: !!row,
        boundAt: row?.boundAt ? formatDateTime(row.boundAt) : null
      }]
    }))
  }
})
