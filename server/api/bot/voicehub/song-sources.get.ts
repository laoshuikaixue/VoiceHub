import { defineEventHandler, getHeader } from 'h3'
import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  ASTRBOT_TOKEN_HEADER,
  equalAstrbotToken
} from '~~/server/utils/astrbot-notification'
import {
  ASTRBOT_SONG_SOURCES,
  DEFAULT_ASTRBOT_SONG_SOURCE
} from '~~/server/utils/astrbot-song-search'
import { enabledCatalog } from '~~/server/utils/music-source-plugins/resolver'

/** 各音源的用户可见名称：与站点前端 locale 的平台名保持一致。 */
const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  netease: '网易云音乐',
  tencent: 'QQ音乐',
  migu: '咪咕音乐',
  bilibili: '哔哩哔哩'
}

/**
 * 机器人点歌的音源列表：按站点「音源控制」的启用顺序（platformOrder）
 * 排列，只下发已启用的音源。序号即插件侧 `-平台` 参数引用的编号。
 */
export default defineEventHandler(async (event) => {
  const [settings] = await db
    .select({
      token: systemSettings.astrbotToken,
      enabled: systemSettings.astrbotEnabled
    })
    .from(systemSettings)
    .limit(1)

  if (!settings?.enabled || !equalAstrbotToken(getHeader(event, ASTRBOT_TOKEN_HEADER) ?? '', settings.token ?? '')) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')
  }

  const sources: { index: number; key: string; name: string }[] = []
  let index = 0
  for (const key of ASTRBOT_SONG_SOURCES) {
    if (!(await enabledCatalog(key))) continue
    index += 1
    sources.push({ index, key, name: SOURCE_DISPLAY_NAMES[key] ?? key })
  }

  return {
    success: true,
    defaultSource: DEFAULT_ASTRBOT_SONG_SOURCE,
    sources
  }
})
