import { defineEventHandler, getHeader, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindings, systemSettings, users } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  ASTRBOT_TOKEN_HEADER,
  equalAstrbotToken,
  isAstrbotPrivateUmoShape
} from '~~/server/utils/astrbot-notification'
import { adapterToAstrbotPlatform, isAstrbotPlatformEnabled } from '~~/server/utils/astrbot-platforms'
import {
  ASTRBOT_SONG_TICKET_PURPOSE,
  isAstrbotSongTicket
} from '~~/server/utils/astrbot-song-search'
import { unseal } from '~~/server/utils/music-source-plugins/tickets'
import { requestSongForUser } from '~~/server/services/songRequestService'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'

/**
 * 机器人点歌投稿：根据搜索票据与序号代绑定账号投稿，完整复用站点投稿规则。
 *
 * 角色与限额均来自数据库真实用户行，绝不硬编码管理员角色，确保限额/时段/
 * 强制关闭投稿等规则对机器人点歌同样生效。
 */
export default defineEventHandler(async (event) => {
  const [settings] = await db
    .select({
      token: systemSettings.astrbotToken,
      enabled: systemSettings.astrbotEnabled,
      platforms: systemSettings.astrbotPlatforms
    })
    .from(systemSettings)
    .limit(1)

  if (!settings?.enabled || !equalAstrbotToken(getHeader(event, ASTRBOT_TOKEN_HEADER) ?? '', settings.token ?? '')) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')
  }

  const body = await readBody(event)
  const umo: unknown = body?.umo

  if (!isAstrbotPrivateUmoShape(umo)) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_UMO_INVALID, '私聊会话无效')
  }

  // 校验绑定状态：总开关 + 平台开关 + 适配器归类
  const [binding] = await db
    .select({ userId: astrbotBindings.userId, platform: astrbotBindings.platform, adapter: astrbotBindings.adapter })
    .from(astrbotBindings)
    .where(eq(astrbotBindings.umo, umo))
    .limit(1)

  if (!binding || !isAstrbotPlatformEnabled(settings.platforms, binding.platform) ||
    adapterToAstrbotPlatform(binding.adapter) !== binding.platform) {
    throw createApiError(403, SERVER_ERROR_CODES.ASTRBOT_UMO_UNBOUND, '该会话未绑定 VoiceHub 账号')
  }

  // 解封票据：过期或 UMO 不一致统一视为会话无效
  let ticket: unknown
  try {
    ticket = unseal(body?.sessionToken, ASTRBOT_SONG_TICKET_PURPOSE)
  } catch {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_SESSION_INVALID, '点歌会话已过期或无效，请重新搜索')
  }

  if (!isAstrbotSongTicket(ticket, umo)) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_SESSION_INVALID, '点歌会话已过期或无效，请重新搜索')
  }

  // 序号校验（1-based）
  const index = Number(body?.index)
  if (!Number.isInteger(index) || index < 1 || index > ticket.candidates.length) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_INDEX_INVALID, '序号超出可点歌曲范围')
  }

  const candidate = ticket.candidates[index - 1]!
  if (!candidate) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_INDEX_INVALID, '序号超出可点歌曲范围')
  }

  // 取绑定账号的真实 role（绝不硬编码管理员，避免豁免限额/时段规则）
  const [user] = await db
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, binding.userId))
    .limit(1)

  if (!user || user.status !== 'active') {
    throw createApiError(403, SERVER_ERROR_CODES.ASTRBOT_UMO_UNBOUND, '绑定账号不可用')
  }

  // 可选参数
  const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : undefined
  const rawCard = typeof body?.cardCode === 'string' ? body.cardCode.trim().toUpperCase() : undefined
  const cardCode = rawCard || undefined

  // 播出时段：仅在站点启用时段选择时传入，避免在未开启时段功能的站点传入无效 ID
  const siteSettings = await getSystemSettingsCached()
  const rawPlayTime = body?.preferredPlayTimeId !== undefined && body.preferredPlayTimeId !== null
    ? Number(body.preferredPlayTimeId)
    : undefined
  const playTimeId = siteSettings?.enablePlayTimeSelection === true &&
    rawPlayTime !== undefined && Number.isInteger(rawPlayTime) && rawPlayTime > 0
    ? rawPlayTime
    : undefined

  const payload = {
    title: candidate.title,
    artist: candidate.artist,
    cover: candidate.cover ?? undefined,
    musicPlatform: candidate.platform,
    musicId: candidate.musicId,
    submissionNote: note,
    cardCode,
    preferredPlayTimeId: playTimeId
    // 候选已由本接口的密封票据保护，不叠加站点选择票据
  }

  let song: any
  try {
    song = await requestSongForUser(event, { id: binding.userId, role: user.role }, payload)
  } catch (error: any) {
    // 站点侧业务错误（限额、时段、重复投稿等）原样透传，保留 statusCode/statusMessage/data
    if (error?.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.statusMessage,
        message: error.message,
        data: error.data
      })
    }
    throw error
  }

  const title = song?.title ?? candidate.title
  const artist = song?.artist ?? candidate.artist

  return {
    success: true,
    message: `点歌成功：${title} - ${artist}`,
    songId: song?.id ?? null,
    title: song?.title ?? candidate.title,
    artist: song?.artist ?? candidate.artist
  }
})
