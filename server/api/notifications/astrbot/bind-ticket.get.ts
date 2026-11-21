import { defineEventHandler, getQuery } from 'h3'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindTickets } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'
import { hashAstrbotBindTicket } from '~~/server/utils/astrbot-notification'

/**
 * 绑定链接预览：只读，绝不在 GET 里落库绑定。
 *
 * 聊天客户端会预取链接做预览，若 GET 即绑定，锁屏预览或安全扫描就能替用户完成绑定。
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录')

  const token = getQuery(event)?.token
  if (typeof token !== 'string' || !/^[a-f0-9]{48}$/.test(token)) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.ASTRBOT_BIND_TICKET_INVALID,
      '绑定链接无效或已过期'
    )
  }

  const [row] = await db
    .select()
    .from(astrbotBindTickets)
    .where(eq(astrbotBindTickets.tokenHash, hashAstrbotBindTicket(token)))
    .limit(1)
  if (!row) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.ASTRBOT_BIND_TICKET_INVALID,
      '绑定链接无效或已过期'
    )
  }

  const expired = row.expiresAt.getTime() <= getServerDate().getTime()
  return {
    success: true,
    platform: row.platform,
    boundUser: row.umo.split(':').at(-1) || null,
    // 已由当前账号确认过：页面直接展示已绑定，重复点击也返回成功。
    confirmedByMe: !!row.consumedAt && row.consumedByUserId === user.id,
    available: !row.consumedAt && !expired,
    expiresAt: row.expiresAt.toISOString()
  }
})
