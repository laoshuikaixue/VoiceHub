import { extractPluginId, getMusicFreeLyric } from '~~/server/utils/musicfree'
import { enforceMusicFreeRateLimit } from '~~/server/utils/musicfreeRateLimit'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

const LYRIC_RATE_LIMIT = 30

export default defineEventHandler(async (event) => {
  await enforceMusicFreeRateLimit(event, 'lyric', LYRIC_RATE_LIMIT, 'MusicFree 插件获取歌词过于频繁')

  const body = await readBody(event)
  const musicItem = body?.musicItem
  if (!musicItem || typeof musicItem !== 'object') {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少音乐信息')
  }

  // 校验必须是 MusicFree 插件来源的歌曲，防止空插件名导致全插件遍历（出站请求放大）
  const pluginId = extractPluginId(musicItem)
  if (!pluginId) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少 MusicFree 插件标识')
  }

  try {
    return { success: true, data: await getMusicFreeLyric(musicItem) }
  } catch (error: any) {
    throw createApiError(502, SERVER_ERROR_CODES.MUSICFREE_LYRIC_FAILED, error?.message || 'MusicFree 插件获取歌词失败')
  }
})
