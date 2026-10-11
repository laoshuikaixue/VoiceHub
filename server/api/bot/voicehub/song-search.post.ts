import { defineEventHandler, getHeader, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindings, systemSettings } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerTimestamp } from '~~/server/utils/serverTime'
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
  ASTRBOT_SONG_CANDIDATE_LIMIT,
  ASTRBOT_SONG_KEYWORD_MAX_LENGTH,
  ASTRBOT_SONG_TICKET_PURPOSE,
  ASTRBOT_SONG_TICKET_TTL_MS,
  parseAstrbotPlatformOrder,
  parseAstrbotSongSource,
  searchSongs,
  type AstrbotSongSource
} from '~~/server/utils/astrbot-song-search'
import { seal } from '~~/server/utils/music-source-plugins/tickets'
import { enabledCatalog } from '~~/server/utils/music-source-plugins/resolver'

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
      platforms: systemSettings.astrbotPlatforms,
      platformOrder: systemSettings.platformOrder
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

  // 音源解析：显式传入照旧校验；缺省时与 song-sources 同口径，
  // 取站点排序（platformOrder）后第一个启用音源，避免与音源列表下发值不一致
  const requestedPlatform = body?.platform
  let platform: AstrbotSongSource | null
  if (requestedPlatform === undefined || requestedPlatform === null) {
    platform = null
    for (const key of parseAstrbotPlatformOrder(settings.platformOrder)) {
      if (await enabledCatalog(key)) {
        platform = key
        break
      }
    }
    if (!platform) {
      throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_PLATFORM_INVALID, '站点当前未启用任何音源')
    }
  } else {
    platform = parseAstrbotSongSource(requestedPlatform)
    if (!platform) {
      throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_PLATFORM_INVALID, '不支持的音源平台')
    }
  }

  // 站点平台管理停用的音源不下发候选：与播放解析共用 enabledCatalog 判定，
  // 避免被停用平台的歌曲仍能经由机器人搜索进入投稿队列。
  if (!(await enabledCatalog(platform))) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_PLATFORM_INVALID, '该音源已被站点停用')
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
