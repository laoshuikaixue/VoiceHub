import { defineEventHandler, readBody } from 'h3'
import { eq, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindingCodes, users } from '~/drizzle/schema'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'
import { isAstrbotPlatformEnabled, parseAstrbotPlatform } from '~~/server/utils/astrbot-platforms'
import {
  ASTRBOT_BIND_TTL_SECONDS, createAstrbotBindCode, hashAstrbotBindCode
} from '~~/server/utils/astrbot-notification'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录')
  const platform = parseAstrbotPlatform((await readBody(event))?.platform)
  if (!platform) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '平台无效')
  const settings = await getSystemSettingsCached()
  if (!settings?.astrbotEnabled || !isAstrbotPlatformEnabled(settings.astrbotPlatforms, platform) || !settings.astrbotToken ||
    (settings.astrbotPushMode !== 'pull' && !settings.astrbotBaseUrl)) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_NOT_CONFIGURED, '机器人推送未启用')
  }

  // 同平台重复发码覆盖旧码，各平台可并存（主键为 userId + platform）。
  const code = createAstrbotBindCode()
  const expiresAt = new Date(getServerDate().getTime() + ASTRBOT_BIND_TTL_SECONDS * 1000)
  await db.transaction(async (tx) => {
    const [account] = await tx.select({ id: users.id })
      .from(users).where(eq(users.id, user.id)).for('update')
    if (!account) throw createApiError(404, SERVER_ERROR_CODES.ASTRBOT_BIND_FAILED, '账号不存在')
    await tx.insert(astrbotBindingCodes).values({
      userId: user.id, platform, codeHash: hashAstrbotBindCode(code), expiresAt, attempts: 0
    }).onConflictDoUpdate({
      target: [astrbotBindingCodes.userId, astrbotBindingCodes.platform],
      set: { codeHash: sql`excluded."codeHash"`, expiresAt, attempts: 0, consumedAt: null }
    })
  })
  return { success: true, code, expiresIn: ASTRBOT_BIND_TTL_SECONDS }
})
