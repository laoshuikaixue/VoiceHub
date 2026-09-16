import { getMusicFreeMediaSource } from '~~/server/utils/musicfree'
import { enforceMusicFreeRateLimit } from '~~/server/utils/musicfreeRateLimit'

const MEDIA_SOURCE_RATE_LIMIT = 30

export default defineEventHandler(async (event) => {
  await enforceMusicFreeRateLimit(event, 'media-source', MEDIA_SOURCE_RATE_LIMIT, 'MusicFree 插件解析播放链接过于频繁')

  const body = await readBody(event)
  const musicItem = body?.musicItem
  if (!musicItem || typeof musicItem !== 'object') {
    throw createError({ statusCode: 400, message: '缺少音乐信息' })
  }

  // 校验必须是 MusicFree 插件来源的歌曲，防止空插件名导致全插件遍历（出站请求放大）
  const platform = String(musicItem.musicPlatform || musicItem.platform || '')
  if (!platform.startsWith('musicfree:')) {
    throw createError({ statusCode: 400, message: '仅支持 MusicFree 插件歌曲' })
  }
  // 拒绝 musicfree: 后缀为空的畸形标识：getMusicFreeMediaSource 已会拒绝，
  // 此处提前返回 400 而非 502，语义更准确
  if (!platform.slice('musicfree:'.length).trim()) {
    throw createError({ statusCode: 400, message: '缺少 MusicFree 插件标识' })
  }

  try {
    const result = await getMusicFreeMediaSource(musicItem, String(body?.quality || 'standard'))
    return { success: true, url: result.url, headers: result.headers }
  } catch (error: any) {
    throw createError({ statusCode: 502, message: error?.message || 'MusicFree 插件获取播放链接失败' })
  }
})
