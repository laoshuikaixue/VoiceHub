import { extractPluginId, getMusicFreeMediaSource } from '~~/server/utils/musicfree'
import { enforceMusicFreeRateLimit } from '~~/server/utils/musicfreeRateLimit'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

const MEDIA_SOURCE_RATE_LIMIT = 30

export default defineEventHandler(async (event) => {
  await enforceMusicFreeRateLimit(event, 'media-source', MEDIA_SOURCE_RATE_LIMIT, 'MusicFree 插件解析播放链接过于频繁')

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
    const result = await getMusicFreeMediaSource(musicItem, String(body?.quality || 'standard'))
    return { success: true, url: result.url, headers: result.headers }
  } catch (error: any) {
    throw createApiError(502, SERVER_ERROR_CODES.MUSICFREE_MEDIA_SOURCE_FAILED, error?.message || 'MusicFree 插件获取播放链接失败')
  }
})
