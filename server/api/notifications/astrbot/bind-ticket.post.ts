import { defineEventHandler, readBody, setResponseHeader } from 'h3'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindTickets, astrbotBindings, authSessions, users } from '~/drizzle/schema'
import { formatDateTime } from '~/utils/timeUtils'
import { adapterToAstrbotPlatform, isAstrbotPlatformEnabled } from '~~/server/utils/astrbot-platforms'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'
import { isUniqueViolation } from '~~/server/utils/db-errors'
import {
  invalidAstrbotBindTicket,
  isSameAstrbotBinding,
  loadAstrbotBindSettings,
  loadAstrbotBindTicket,
  loadOwnAstrbotBinding
} from '~~/server/utils/astrbot-bind-ticket'
import { equalAstrbotToken, hashAstrbotBindTicket, makeAstrbotBindConfirmation } from '~~/server/utils/astrbot-notification'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const user = event.context.user
  if (!user?.sessionId) throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录')

  const { token, confirmation } = (await readBody(event)) ?? {}
  if (typeof token !== 'string' || !/^[a-f0-9]{48}$/.test(token) ||
    typeof confirmation !== 'string' || !/^[a-f0-9]{64}$/.test(confirmation)) {
    throw invalidAstrbotBindTicket()
  }

  try {
    return await db.transaction(async (tx) => {
      const [settings] = await loadAstrbotBindSettings(tx, true)
      if (!settings?.enabled || !settings.token) {
        throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_NOT_CONFIGURED, '机器人推送未启用')
      }
      const hash = hashAstrbotBindTicket(token, settings.token)
      const expected = makeAstrbotBindConfirmation(hash, settings.token, user.id, user.sessionId, user.tokenVersion)
      if (!equalAstrbotToken(confirmation, expected)) throw invalidAstrbotBindTicket()

      // 和解绑共用用户行锁；会话行锁防止已撤销的登录会话继续确认。
      const [account] = await tx.select({
        status: users.status, tokenVersion: users.tokenVersion, forcePasswordChange: users.forcePasswordChange
      }).from(users).where(eq(users.id, user.id)).for('update')
      const [session] = await tx.select({ id: authSessions.id }).from(authSessions).where(and(
        eq(authSessions.id, user.sessionId), eq(authSessions.userId, user.id),
        isNull(authSessions.revokedAt), gt(authSessions.expiresAt, getServerDate())
      )).for('share')
      if (!account || account.status !== 'active' || account.tokenVersion !== user.tokenVersion ||
        account.forcePasswordChange || !session) {
        throw createApiError(401, SERVER_ERROR_CODES.AUTH_SESSION_EXPIRED, '登录会话已失效')
      }

      const [row] = await loadAstrbotBindTicket(tx, hash)
      if (!row || (row.consumedAt && row.consumedByUserId !== user.id)) throw invalidAstrbotBindTicket()
      if (adapterToAstrbotPlatform(row.adapter) !== row.platform ||
        !isAstrbotPlatformEnabled(settings.platforms, row.platform)) {
        throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_NOT_CONFIGURED, '该机器人平台未启用')
      }

      const [current] = await loadOwnAstrbotBinding(tx, user.id, row.platform)
      const sameBinding = isSameAstrbotBinding(current, row)
      if (row.consumedAt) {
        if (sameBinding) return { success: true, platform: row.platform, boundAt: formatDateTime(current.boundAt) }
        throw invalidAstrbotBindTicket()
      }
      if (current && !sameBinding) {
        throw createApiError(409, SERVER_ERROR_CODES.ASTRBOT_ACCOUNT_ALREADY_BOUND, '请先解绑当前平台的已有会话')
      }

      // 与解绑保持相同的写入顺序：先绑定行，再票据行。
      const boundAt = sameBinding ? current.boundAt : getServerDate()
      if (!sameBinding) {
        await tx.insert(astrbotBindings).values({
          userId: user.id, platform: row.platform, adapter: row.adapter, umo: row.umo, boundAt
        })
      }
      const now = getServerDate()
      const [claim] = await tx.update(astrbotBindTickets)
        .set({ consumedAt: now, consumedByUserId: user.id })
        .where(and(eq(astrbotBindTickets.tokenHash, hash), isNull(astrbotBindTickets.consumedAt),
          gt(astrbotBindTickets.expiresAt, now)))
        .returning({ platform: astrbotBindTickets.platform })
      if (!claim) throw invalidAstrbotBindTicket()

      return { success: true, platform: row.platform, boundAt: formatDateTime(boundAt) }
    })
  } catch (error) {
    // 会话唯一索引阻止多个账号占用同一会话。
    if (isUniqueViolation(error)) {
      throw createApiError(409, SERVER_ERROR_CODES.ASTRBOT_UMO_BOUND, '此会话已绑定其他账号')
    }
    throw error
  }
})
