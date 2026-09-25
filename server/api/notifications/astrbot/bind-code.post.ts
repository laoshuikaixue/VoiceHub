import { defineEventHandler } from 'h3'
import { eq, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindingCodes, users } from '~/drizzle/schema'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'
import {
  ASTRBOT_BIND_TTL_SECONDS, createAstrbotBindCode, hashAstrbotBindCode
} from '~~/server/utils/astrbot-notification'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录')
  const settings = await getSystemSettingsCached()
  if (!settings?.astrbotEnabled || !settings.astrbotToken || !settings.astrbotBaseUrl) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_NOT_CONFIGURED, '机器人推送未启用')
  }

  // 每账号只保留一个有效码，重新生成会立即覆盖旧码。
  const code = createAstrbotBindCode()
  const expiresAt = new Date(getServerDate().getTime() + ASTRBOT_BIND_TTL_SECONDS * 1000)
  await db.transaction(async (tx) => {
    const [account] = await tx.select({ id: users.id })
      .from(users).where(eq(users.id, user.id)).for('update')
    if (!account) throw createApiError(404, SERVER_ERROR_CODES.ASTRBOT_BIND_FAILED, '账号不存在')
    await tx.insert(astrbotBindingCodes).values({
      userId: user.id, codeHash: hashAstrbotBindCode(code), expiresAt, attempts: 0
    }).onConflictDoUpdate({
      target: astrbotBindingCodes.userId,
      set: { codeHash: sql`excluded."codeHash"`, expiresAt, attempts: 0, consumedAt: null }
    })
  })
  return { success: true, code, expiresIn: ASTRBOT_BIND_TTL_SECONDS }
})
