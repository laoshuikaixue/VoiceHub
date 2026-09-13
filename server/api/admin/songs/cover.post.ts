import { readBody } from 'h3'
import { db } from '~/drizzle/db'
import { songs } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { fetchSongCover } from '~~/server/utils/songCoverFetcher'

// 获取歌曲封面 URL（仅返回，不写库，由前端填入表单随弹窗保存）
export default defineEventHandler(async (event) => {
  requireSongAdmin(event)

  const body = await readBody(event)
  let platform: string | null
  let musicId: string | null
  let songId: number | null = null

  if (body?.songId != null) {
    songId = Number(body.songId)
    if (!Number.isFinite(songId) || songId < 1) {
      throw createApiError(400, SERVER_ERROR_CODES.SONG_INVALID_ID, '歌曲 ID 无效')
    }
    const song = await db.select().from(songs).where(eq(songs.id, songId)).limit(1)
    if (song.length === 0) {
      throw createApiError(404, SERVER_ERROR_CODES.SONG_NOT_FOUND, '歌曲不存在')
    }
    platform = song[0].musicPlatform
    musicId = song[0].musicId
  } else {
    // 新增歌曲场景：按平台+音乐ID获取
    platform = body?.platform ? String(body.platform) : null
    musicId = body?.musicId ? String(body.musicId) : null
  }

  if (!platform || !musicId) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.SONG_COVER_PLATFORM_REQUIRED,
      '歌曲缺少平台或音乐 ID 信息，无法获取封面'
    )
  }

  const cover = await fetchSongCover(platform, musicId)
  if (!cover) {
    return { success: false, songId, cover: null, message: '平台接口未返回有效封面' }
  }

  return { success: true, songId, cover, message: '封面获取成功' }
})
