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
  ASTRBOT_SONG_SOURCES
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
 * 容错解析站点 platformOrder：非法 JSON/空数组回退白名单全量，
 * 再补齐白名单缺失项（与 platform-config 公开接口同口径）。
 */
function parsePlatformOrder(value: unknown): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(typeof value === 'string' ? value : '[]')
  } catch {
    parsed = null
  }
  const valid = (Array.isArray(parsed) ? parsed : [])
    .filter((p) => (ASTRBOT_SONG_SOURCES as readonly string[]).includes(p as string)) as string[]
  if (valid.length === 0) return [...ASTRBOT_SONG_SOURCES]
  const merged = [...valid]
  for (const p of ASTRBOT_SONG_SOURCES) {
    if (!merged.includes(p)) merged.push(p)
  }
  return merged
}

/**
 * 机器人点歌的音源列表：按站点「音源控制」的启用顺序（platformOrder）
 * 排列，只下发已启用的音源。序号即插件侧 `-平台` 参数引用的编号。
 */
export default defineEventHandler(async (event) => {
  const [settings] = await db
    .select({
      token: systemSettings.astrbotToken,
      enabled: systemSettings.astrbotEnabled,
      platformOrder: systemSettings.platformOrder
    })
    .from(systemSettings)
    .limit(1)

  if (!settings?.enabled || !equalAstrbotToken(getHeader(event, ASTRBOT_TOKEN_HEADER) ?? '', settings.token ?? '')) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')
  }

  const sources: { index: number; key: string; name: string }[] = []
  let index = 0
  for (const key of parsePlatformOrder(settings.platformOrder)) {
    if (!(await enabledCatalog(key))) continue
    index += 1
    sources.push({ index, key, name: SOURCE_DISPLAY_NAMES[key] ?? key })
  }

  return {
    success: true,
    // 默认音源取排序后第一个启用的音源；全部停用时为 null
    defaultSource: sources[0]?.key ?? null,
    sources
  }
})
