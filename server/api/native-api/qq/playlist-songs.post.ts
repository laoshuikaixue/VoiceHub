import { getQqPlaylistSongs } from '~~/server/utils/qq_music_sdk'

// 获取 QQ 音乐歌单内歌曲列表；favSongs=true 时返回"我喜欢"歌曲
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const cookie = String(body?.cookie || '').trim()
  const disstid = String(body?.disstid || '').trim()
  const favSongs = Boolean(body?.favSongs)
  const limit = Math.min(Math.max(Number(body?.limit) || 100, 1), 500)
  const offset = Math.max(Number(body?.offset) || 0, 0)

  if (!cookie || (!disstid && !favSongs)) {
    throw createError({ statusCode: 400, message: '缺少 cookie 或 disstid 参数' })
  }

  try {
    const result = await getQqPlaylistSongs({ disstid, favSongs, cookie, limit, offset })
    return { success: true, data: result }
  } catch (error: any) {
    console.warn('[qq/playlist-songs] 获取歌单歌曲失败:', error?.message || error)
    throw createError({
      statusCode: 502,
      message: error?.message || '获取歌单歌曲失败'
    })
  }
})
