import { defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录')
  const [row] = await db.select({ umo: users.astrbotUmo, platform: users.astrbotPlatform })
    .from(users).where(eq(users.id, user.id)).limit(1)
  const settings = await getSystemSettingsCached()
  return {
    success: true,
    enabled: !!settings?.astrbotEnabled,
    bound: !!row?.umo,
    platform: row?.platform ?? null,
    umo: row?.umo ?? null,
    account: row?.umo ?? null
  }
})
