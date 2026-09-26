import { defineEventHandler, getHeader, readBody } from 'h3'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindingCodes, astrbotBindings, systemSettings, users } from '~/drizzle/schema'
import { adapterToAstrbotPlatform, isAstrbotPlatformEnabled } from '~~/server/utils/astrbot-platforms'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'
import { isUniqueViolation } from '~~/server/utils/db-errors'
import {
  ASTRBOT_TOKEN_HEADER, equalAstrbotToken, hashAstrbotBindCode, parseAstrbotPrivateUmo
} from '~~/server/utils/astrbot-notification'

export default defineEventHandler(async (event) => {
  const [settings] = await db.select({ token: systemSettings.astrbotToken, enabled: systemSettings.astrbotEnabled, platforms: systemSettings.astrbotPlatforms })
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
  const [codeRow] = await db.select({ userId: astrbotBindingCodes.userId, platform: astrbotBindingCodes.platform })
    .from(astrbotBindingCodes).where(eq(astrbotBindingCodes.codeHash, hash)).limit(1)
  const requestedPlatform = adapterToAstrbotPlatform(target?.platform)
  if (!requestedPlatform || !isAstrbotPlatformEnabled(settings.platforms, requestedPlatform)) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_NOT_CONFIGURED, '该机器人平台未启用')
  }
  if (!codeRow || codeRow.platform !== requestedPlatform) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_BIND_CODE_INVALID, '绑定码无效、已过期或已使用')
  }

  try {
    return await db.transaction(async (tx) => {
      // 全部发码、绑定、解绑均先锁用户行，防止解绑后旧请求重新绑定。
      const [account] = await tx.select({ username: users.username })
        .from(users).where(eq(users.id, codeRow.userId)).for('update')
      if (!account) throw createApiError(404, SERVER_ERROR_CODES.ASTRBOT_BIND_FAILED, '账号不存在')

      const [owner] = await tx.select({ id: astrbotBindings.userId })
        .from(astrbotBindings).where(eq(astrbotBindings.umo, target.umo)).limit(1)
      if (owner && owner.id !== codeRow.userId) {
        throw createApiError(409, SERVER_ERROR_CODES.ASTRBOT_UMO_BOUND, '此会话已绑定其他账号')
      }

      const [claim] = await tx.update(astrbotBindingCodes)
        .set({ consumedAt: getServerDate() })
        .where(and(
          eq(astrbotBindingCodes.userId, codeRow.userId),
          eq(astrbotBindingCodes.codeHash, hash),
          eq(astrbotBindingCodes.platform, requestedPlatform),
          gt(astrbotBindingCodes.expiresAt, getServerDate()),
          isNull(astrbotBindingCodes.consumedAt)
        )).returning({ userId: astrbotBindingCodes.userId })
      if (!claim) {
        throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_BIND_CODE_INVALID, '绑定码无效、已过期或已使用')
      }
      await tx.insert(astrbotBindings).values({ userId: codeRow.userId, platform: requestedPlatform,
        adapter: target.platform, umo: target.umo, boundAt: getServerDate() })
        .onConflictDoUpdate({ target: [astrbotBindings.userId, astrbotBindings.platform],
          set: { adapter: target.platform, umo: target.umo, boundAt: getServerDate() } })
      return { success: true, username: account.username }
    })
  } catch (error) {
    // 用户唯一约束兜底阻止不同账号并发抢占同一会话；错误码在 cause 上。
    if (isUniqueViolation(error)) {
      throw createApiError(409, SERVER_ERROR_CODES.ASTRBOT_UMO_BOUND, '此会话已绑定其他账号')
    }
    throw error
  }
})
