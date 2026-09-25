import { defineEventHandler, getHeader, readBody } from 'h3'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindingCodes, systemSettings, users } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'
import {
  ASTRBOT_TOKEN_HEADER, equalAstrbotToken, hashAstrbotBindCode, parseAstrbotPrivateUmo
} from '~~/server/utils/astrbot-notification'

export default defineEventHandler(async (event) => {
  const [settings] = await db.select({ token: systemSettings.astrbotToken, enabled: systemSettings.astrbotEnabled })
    .from(systemSettings).limit(1)
  if (!settings?.enabled || !equalAstrbotToken(getHeader(event, ASTRBOT_TOKEN_HEADER) ?? '', settings.token ?? '')) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')
  }
  const body = await readBody(event)
  const rawCode = body?.code
  const target = parseAstrbotPrivateUmo(body?.umo, body?.platform)
  if (typeof rawCode !== 'string' || !/^[a-f0-9]{24}$/.test(rawCode) || !target) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_BIND_CODE_INVALID, '绑定码或私聊会话无效')
  }

  const hash = hashAstrbotBindCode(rawCode)
  // 一次条件 UPDATE 完成消耗与错误次数限制；仅首个并发请求可成功。
  const [claim] = await db.update(astrbotBindingCodes)
    .set({ consumedAt: getServerDate() })
    .where(and(
      eq(astrbotBindingCodes.codeHash, hash),
      gt(astrbotBindingCodes.expiresAt, getServerDate()),
      isNull(astrbotBindingCodes.consumedAt),
      sql`${astrbotBindingCodes.attempts} < 5`
    )).returning({ userId: astrbotBindingCodes.userId })
  if (!claim) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_BIND_CODE_INVALID, '绑定码无效、已过期或已使用')
  }

  const [owner] = await db.select({ id: users.id })
    .from(users).where(eq(users.astrbotUmo, target.umo)).limit(1)
  if (owner && owner.id !== claim.userId) {
    throw createApiError(409, SERVER_ERROR_CODES.ASTRBOT_UMO_BOUND, '此会话已绑定其他账号')
  }
  let updated
  try {
    [updated] = await db.update(users).set({
      astrbotUmo: target.umo,
      astrbotPlatform: target.platform,
      astrbotBoundAt: getServerDate()
    }).where(eq(users.id, claim.userId)).returning({ username: users.username })
  } catch (error) {
    // 用户唯一约束兜底阻止不同账号并发抢占同一会话。
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      throw createApiError(409, SERVER_ERROR_CODES.ASTRBOT_UMO_BOUND, '此会话已绑定其他账号')
    }
    throw error
  }
  if (!updated) throw createApiError(404, SERVER_ERROR_CODES.ASTRBOT_BIND_FAILED, '账号不存在')
  return { success: true, username: updated.username }
})
