import { defineEventHandler, getHeader, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindings, systemSettings } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import {
  ASTRBOT_TOKEN_HEADER,
  equalAstrbotToken,
  isAstrbotPrivateUmoShape
} from '~~/server/utils/astrbot-notification'
import { adapterToAstrbotPlatform, isAstrbotPlatformEnabled } from '~~/server/utils/astrbot-platforms'
import {
  ASTRBOT_SONG_CANDIDATE_LIMIT,
  ASTRBOT_SONG_KEYWORD_MAX_LENGTH,
  ASTRBOT_SONG_TICKET_PURPOSE,
  ASTRBOT_SONG_TICKET_TTL_MS,
  DEFAULT_ASTRBOT_SONG_SOURCE,
  parseAstrbotSongSource,
  searchSongs
} from '~~/server/utils/astrbot-song-search'
import { seal } from '~~/server/utils/music-source-plugins/tickets'

/**
 * 机器人点歌搜索：按关键词搜索候选曲目，把结果与发起会话密封为票据。
 *
 * 插件持票据向 song-request 投稿，避免序号被换绑。
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

  const keyword = typeof body?.keyword === 'string' ? body.keyword.trim() : ''
  if (!keyword || keyword.length > ASTRBOT_SONG_KEYWORD_MAX_LENGTH) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_KEYWORD_INVALID, '点歌关键词无效')
  }

  const platform = parseAstrbotSongSource(body?.platform ?? DEFAULT_ASTRBOT_SONG_SOURCE)
  if (!platform) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_PLATFORM_INVALID, '不支持的音源平台')
  }

  const page = Number.isInteger(body?.page) && body.page > 0 ? body.page : 1
  const candidates = await searchSongs(platform, keyword, page)

  const sessionToken = seal({
    umo,
    platform,
    keyword,
    createdAt: getServerTimestamp(),
    candidates
  }, ASTRBOT_SONG_TICKET_PURPOSE, ASTRBOT_SONG_TICKET_TTL_MS)

  return {
    success: true,
    keyword,
    platform,
    sessionToken,
    count: candidates.length,
    items: candidates.map((candidate, index) => ({
      index: index + 1,
      title: candidate.title,
      artist: candidate.artist,
      durationSeconds: candidate.durationSeconds
    }))
  }
})
