import { defineEventHandler, readBody } from 'h3'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindTickets, astrbotBindings, users } from '~/drizzle/schema'
import {
  adapterToAstrbotPlatform,
  isAstrbotPlatformEnabled
} from '~~/server/utils/astrbot-platforms'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { isUniqueViolation } from '~~/server/utils/db-errors'
import { hashAstrbotBindTicket } from '~~/server/utils/astrbot-notification'

/**
 * 用户在浏览器确认绑定链接：把票据指向的私聊会话绑到当前登录账号。
 *
 * 必须在 POST + 登录态下执行——GET 只做预览，避免聊天客户端预取链接时被
 * 无感完成绑定。
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录')

  const token = (await readBody(event))?.token
  if (typeof token !== 'string' || !/^[a-f0-9]{48}$/.test(token)) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.ASTRBOT_BIND_TICKET_INVALID,
      '绑定链接无效或已过期'
    )
  }
  const settings = await getSystemSettingsCached()
  if (!settings?.astrbotEnabled) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_NOT_CONFIGURED, '机器人推送未启用')
  }

  const hash = hashAstrbotBindTicket(token)
  try {
    return await db.transaction(async (tx) => {
      // 与发码、绑定一致：先锁用户行，避免解绑后旧请求重新绑定。
      const [account] = await tx
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, user.id))
        .for('update')
      if (!account) throw createApiError(404, SERVER_ERROR_CODES.ASTRBOT_BIND_FAILED, '账号不存在')

      const [row] = await tx
        .select()
        .from(astrbotBindTickets)
        .where(eq(astrbotBindTickets.tokenHash, hash))
        .limit(1)
      if (!row) {
        throw createApiError(
          400,
          SERVER_ERROR_CODES.ASTRBOT_BIND_TICKET_INVALID,
          '绑定链接无效或已过期'
        )
      }
      // 重复点击同一链接：同一账号再次确认直接返回成功，不重复写绑定。
      if (row.consumedAt) {
        if (row.consumedByUserId === user.id) {
          return { success: true, username: account.username, platform: row.platform }
        }
        throw createApiError(
          400,
          SERVER_ERROR_CODES.ASTRBOT_BIND_TICKET_INVALID,
          '绑定链接已被使用'
        )
      }
      if (row.expiresAt.getTime() <= getServerDate().getTime()) {
        throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_BIND_TICKET_INVALID, '绑定链接已过期')
      }
      if (
        adapterToAstrbotPlatform(row.adapter) !== row.platform ||
        !isAstrbotPlatformEnabled(settings.astrbotPlatforms, row.platform)
      ) {
        throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_NOT_CONFIGURED, '该机器人平台未启用')
      }

      const [owner] = await tx
        .select({ id: astrbotBindings.userId })
        .from(astrbotBindings)
        .where(eq(astrbotBindings.umo, row.umo))
        .limit(1)
      if (owner && owner.id !== user.id) {
        throw createApiError(409, SERVER_ERROR_CODES.ASTRBOT_UMO_BOUND, '此会话已绑定其他账号')
      }

      const [claim] = await tx
        .update(astrbotBindTickets)
        .set({ consumedAt: getServerDate(), consumedByUserId: user.id })
        .where(
          and(
            eq(astrbotBindTickets.tokenHash, hash),
            isNull(astrbotBindTickets.consumedAt),
            gt(astrbotBindTickets.expiresAt, getServerDate())
          )
        )
        .returning({ platform: astrbotBindTickets.platform })
      if (!claim) {
        throw createApiError(
          400,
          SERVER_ERROR_CODES.ASTRBOT_BIND_TICKET_INVALID,
          '绑定链接已被使用'
        )
      }

      await tx
        .insert(astrbotBindings)
        .values({
          userId: user.id,
          platform: row.platform,
          adapter: row.adapter,
          umo: row.umo,
          boundAt: getServerDate()
        })
        .onConflictDoUpdate({
          target: [astrbotBindings.userId, astrbotBindings.platform],
          set: { adapter: row.adapter, umo: row.umo, boundAt: getServerDate() }
        })
      return { success: true, username: account.username, platform: row.platform }
    })
  } catch (error) {
    // 并发抢占同一会话由 umo 唯一索引兜底。
    if (isUniqueViolation(error)) {
      throw createApiError(409, SERVER_ERROR_CODES.ASTRBOT_UMO_BOUND, '此会话已绑定其他账号')
    }
    throw error
  }
})
