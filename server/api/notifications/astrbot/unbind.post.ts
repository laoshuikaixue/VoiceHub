import { defineEventHandler, readBody } from 'h3'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindingCodes, astrbotBindings, users } from '~/drizzle/schema'

import { parseAstrbotPlatform } from '~~/server/utils/astrbot-platforms'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录')
  const platform = parseAstrbotPlatform((await readBody(event))?.platform)
  if (!platform) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '平台无效')
  return db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update')
    await tx.delete(astrbotBindings).where(and(eq(astrbotBindings.userId, user.id), eq(astrbotBindings.platform, platform)))
    // 解绑只清该平台未消费的码；已消费的保留，便于审计与幂等。
    await tx.delete(astrbotBindingCodes).where(and(eq(astrbotBindingCodes.userId, user.id),
      eq(astrbotBindingCodes.platform, platform), isNull(astrbotBindingCodes.consumedAt)))
    return { success: true }
  })
})
