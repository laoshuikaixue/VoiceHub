import { searchMusicFreePlugins } from '~~/server/utils/musicfree'
import { enforceMusicFreeRateLimit } from '~~/server/utils/musicfreeRateLimit'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

const SEARCH_RATE_LIMIT = 20

export default defineEventHandler(async (event) => {
  await enforceMusicFreeRateLimit(event, 'search', SEARCH_RATE_LIMIT, 'MusicFree 插件搜索过于频繁')

  const body = await readBody(event)
  const query = String(body?.query || '').trim()
  if (!query) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少搜索关键词')

  // 传入带 musicfree: 前缀的插件标识时只搜该插件；缺省则聚合搜索全部插件
  const pluginId = String(body?.pluginId || '').trim()
  const pluginName = pluginId.startsWith('musicfree:') ? pluginId.slice('musicfree:'.length).trim() : pluginId
  // 拒绝 musicfree: 后缀为空的畸形标识，防止空插件名导致全插件扇出
  if (pluginId && !pluginName) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '无效的插件标识')
  }

  try {
    return {
      success: true,
      data: await searchMusicFreePlugins(query, Number(body?.page || 1), Number(body?.limit || 20), pluginName)
    }
  } catch (error: any) {
    throw createApiError(502, SERVER_ERROR_CODES.MUSICFREE_SEARCH_FAILED, error?.message || 'MusicFree 插件搜索失败')
  }
})
