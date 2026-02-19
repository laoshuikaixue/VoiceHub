import { db } from '~/drizzle/db'
import { songs, users } from '~/drizzle/schema'
import { and, eq, or } from 'drizzle-orm'
import { cacheService } from '~~/server/services/cacheService'

export default defineEventHandler(async (event) => {
  try {
    // 验证请求方法
    if (event.node.req.method !== 'POST') {
      throw createError({
        statusCode: 405,
        statusMessage: 'Method Not Allowed'
      })
    }

    // 获取已验证的用户信息（由中间件提供）
    const user = event.context.user
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: '未授权访问'
      })
    }

    // 检查权限
    if (!['ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: '权限不足'
      })
    }

    // 获取请求体
    const body = await readBody(event)
    const { title, artist, requester, semester, musicPlatform, musicId, cover, playUrl } = body

    // 验证必填字段
    if (!title || !artist) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Title and artist are required'
      })
    }

    // 查找投稿人用户
    let requesterId = null
    if (requester) {
      // 检查requester是否为数字ID
      const parsedId = parseInt(requester)
      let requesterUser = null

      if (!isNaN(parsedId) && parsedId > 0) {
        // 如果是有效的数字ID，直接按ID查找
        const userResult = await db.select().from(users).where(eq(users.id, parsedId)).limit(1)
        requesterUser = userResult[0]
      } else {
        // 如果不是数字ID，按用户名或姓名查找
        const userResult = await db
          .select()
          .from(users)
          .where(or(eq(users.username, String(requester)), eq(users.name, String(requester))))
          .limit(1)
        requesterUser = userResult[0]
      }

      requesterId = requesterUser?.id || null
    }

    // 检查歌曲是否已存在
    const existingSongResult = await db
      .select()
      .from(songs)
      .where(
        and(
          eq(songs.title, title.trim()),
          eq(songs.artist, artist.trim()),
          requesterId ? eq(songs.requesterId, requesterId) : eq(songs.requesterId, null)
        )
      )
      .limit(1)
    const existingSong = existingSongResult[0]

    if (existingSong) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Song already exists'
      })
    }

    // 创建歌曲
    const newSongResult = await db
      .insert(songs)
      .values({
        title: title.trim(),
        artist: artist.trim(),
        requesterId,
        semester: semester || null,
        musicPlatform: musicPlatform || null,
        musicId: musicId || null,
        cover: cover || null,
        playUrl: playUrl || null
      })
      .returning()

    const newSong = newSongResult[0]

    // 获取投稿人信息
    let requesterInfo = null
    if (newSong.requesterId) {
      const requesterResult = await db
        .select({
          id: users.id,
          username: users.username,
          name: users.name
        })
        .from(users)
        .where(eq(users.id, newSong.requesterId))
        .limit(1)
      requesterInfo = requesterResult[0]
    }

    // 组合返回数据
    const songWithRequester = {
      ...newSong,
      requester: requesterInfo
    }

    // 清除歌曲相关缓存
    try {
      await cacheService.clearSongsCache()
      console.log('[Cache] 歌曲缓存已清除（添加歌曲）')
    } catch (error) {
      console.error('清除歌曲缓存失败:', error)
    }

    return {
      success: true,
      song: songWithRequester
    }
  } catch (error) {
    console.error('Add song error:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})
