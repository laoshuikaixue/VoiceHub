import { defineEventHandler, getHeader, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindings, systemSettings, users } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES, SUBMISSION_NOTE_MAX_LENGTH } from '~~/server/config/constants'
import {
  ASTRBOT_TOKEN_HEADER,
  equalAstrbotToken
} from '~~/server/utils/astrbot-notification'
import {
  adapterToAstrbotPlatform,
  isAstrbotPlatformEnabled,
  isAstrbotPrivateUmoShape
} from '~~/server/utils/astrbot-platforms'
import {
  ASTRBOT_SONG_TICKET_PURPOSE,
  isAstrbotSongTicket
} from '~~/server/utils/astrbot-song-search'
import { unseal } from '~~/server/utils/music-source-plugins/tickets'
import { enabledCatalog } from '~~/server/utils/music-source-plugins/resolver'
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

  // 手动投稿分支：body.manual = { title, artist }，无票据无 musicId
  // （对应站点表单「没有我想要的歌曲，手动输入提交」，复用同一投稿规则）
  const manual = body?.manual
  const isManual = manual !== null && typeof manual === 'object'
  let candidate: { title: string; artist: string; cover: string | null; platform: string; musicId: string } | undefined

  if (!isManual) {
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

    // 票据签发后管理员可能已停用该平台：投稿前复查启用状态（与 song-search 同口径）
    if (!(await enabledCatalog(ticket.platform))) {
      throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_PLATFORM_INVALID, '该音源已被站点停用')
    }

    // 序号校验（1-based）
    const index = Number(body?.index)
    if (!Number.isInteger(index) || index < 1 || index > ticket.candidates.length) {
      throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_INDEX_INVALID, '序号超出可点歌曲范围')
    }

    candidate = ticket.candidates[index - 1]!
    if (!candidate) {
      throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_INDEX_INVALID, '序号超出可点歌曲范围')
    }
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
  // 留言（submissionNote）：站点未开启留言功能时，songRequestService 会把它静默
  // 丢弃（`enableSubmissionRemarks && rawSubmissionNote`）并照常返回成功，用户会收到
  // 「点歌成功」而留言已丢失。这里必须前置拒绝，不能把静默丢弃当成功。
  const siteSettings = await getSystemSettingsCached()
  const rawNote = typeof body?.note === 'string' ? body.note.trim() : ''
  if (rawNote) {
    if (siteSettings?.enableSubmissionRemarks !== true) {
      throw createApiError(
        400,
        SERVER_ERROR_CODES.ASTRBOT_SONG_NOTE_DISABLED,
        '本站未开启留言功能，无法提交留言。'
      )
    }
    if (rawNote.length > SUBMISSION_NOTE_MAX_LENGTH) {
      throw createApiError(
        400,
        SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
        `留言不能超过 ${SUBMISSION_NOTE_MAX_LENGTH} 个字符。`
      )
    }
  }
  const note = rawNote || undefined
  const rawCard = typeof body?.cardCode === 'string' ? body.cardCode.trim().toUpperCase() : undefined
  const cardCode = rawCard || undefined

  // 播出时段：仅在站点启用时段选择时传入，避免在未开启时段功能的站点传入无效 ID
  const rawPlayTime = body?.preferredPlayTimeId !== undefined && body.preferredPlayTimeId !== null
    ? Number(body.preferredPlayTimeId)
    : undefined
  const playTimeId = siteSettings?.enablePlayTimeSelection === true &&
    rawPlayTime !== undefined && Number.isInteger(rawPlayTime) && rawPlayTime > 0
    ? rawPlayTime
    : undefined

  const payload = isManual
    ? {
        // 手动投稿：无平台标识、无 musicId，标题/歌手来自用户输入
        title: String(manual.title ?? '').trim(),
        artist: String(manual.artist ?? '').trim(),
        submissionNote: note,
        cardCode,
        preferredPlayTimeId: playTimeId
      }
    : {
        title: candidate!.title,
        artist: candidate!.artist,
        cover: candidate!.cover ?? undefined,
        musicPlatform: candidate!.platform,
        musicId: candidate!.musicId,
        submissionNote: note,
        cardCode,
        preferredPlayTimeId: playTimeId
        // 候选已由本接口的密封票据保护，不叠加站点选择票据
      }

  if (isManual && (!payload.title || !payload.artist)) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '手动投稿需要歌名与歌手')
  }

  const fallbackTitle = isManual ? payload.title : candidate!.title
  const fallbackArtist = isManual ? payload.artist : candidate!.artist

  let song: any
  try {
    song = await requestSongForUser(event, { id: binding.userId, role: user.role }, payload)
  } catch (error: any) {
    // 站点侧业务错误保留原错误码；无稳定码的参数错误统一归入通用参数错误。
    if (error?.statusCode) {
      const code = typeof error.data?.code === 'string'
        ? error.data.code
        : typeof error.statusMessage === 'string' && Object.values(SERVER_ERROR_CODES).includes(error.statusMessage)
          ? error.statusMessage
          : SERVER_ERROR_CODES.COMMON_INVALID_PARAMS
      const data = error.data && typeof error.data === 'object' ? { ...error.data } : undefined
      if (data) delete data.code
      throw createApiError(error.statusCode, code, error.message || '点歌失败', data)
    }
    throw error
  }

  const title = song?.title ?? fallbackTitle
  const artist = song?.artist ?? fallbackArtist

  return {
    success: true,
    message: `点歌成功：${title} - ${artist}`,
    songId: song?.id ?? null,
    title,
    artist
  }
})
