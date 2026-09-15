import { getMusicFreeLyric } from '~~/server/utils/musicfree'
import { enforceMusicFreeRateLimit } from '~~/server/utils/musicfreeRateLimit'

const LYRIC_RATE_LIMIT = 30

export default defineEventHandler(async (event) => {
  await enforceMusicFreeRateLimit(event, 'lyric', LYRIC_RATE_LIMIT, 'MusicFree 插件获取歌词过于频繁')

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

  try {
    return { success: true, data: await getMusicFreeLyric(musicItem) }
  } catch (error: any) {
    throw createError({ statusCode: 502, message: error?.message || 'MusicFree 插件获取歌词失败' })
  }
})
