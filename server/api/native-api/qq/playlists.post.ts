import { getQqUserPlaylists } from '~~/server/utils/qq_music_sdk'

// 获取用户创建（含"我喜欢"）与收藏的 QQ 音乐歌单
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const cookie = String(body?.cookie || '').trim()

  if (!cookie) {
    throw createError({ statusCode: 400, message: '缺少 cookie 参数' })
  }

  try {
    const result = await getQqUserPlaylists({ cookie })
    return { success: true, data: result }
  } catch (error: any) {
    console.warn('[qq/playlists] 获取用户歌单失败:', error?.message || error)
    throw createError({
      statusCode: 502,
      message: error?.message || '获取用户歌单失败'
    })
  }
})
