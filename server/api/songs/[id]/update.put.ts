import { db } from '~/drizzle/db'
import { songs, users, songCollaborators, collaborationLogs } from '~/drizzle/schema'
import { eq, or } from 'drizzle-orm'
import { cacheService } from '~~/server/services/cacheService'

export default defineEventHandler(async (event) => {
  try {
    // 验证请求方法
    if (event.node.req.method !== 'PUT') {
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

    // 获取歌曲ID
    const songId = parseInt(getRouterParam(event, 'id'))
    if (!songId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid song ID'
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

    // 准备更新数据
    const updateData = {
      title: title.trim(),
      artist: artist.trim(),
      semester: semester || null,
      musicPlatform: musicPlatform || null,
      musicId: musicId || null,
      cover: cover || null,
      playUrl: playUrl || null
    }

    // 处理投稿人
    if ('requester' in body) {
      const requester = body.requester

      // 只有在传递有效投稿人信息时才更新
      if (requester && requester !== '' && requester !== 0) {
        // 查找投稿人用户
        const conditions = []
        if (typeof requester === 'number') {
          conditions.push(eq(users.id, requester))
        }
        if (typeof requester === 'string') {
          conditions.push(eq(users.username, requester))
          conditions.push(eq(users.name, requester))
        }

        const requesterUser = await db
          .select()
          .from(users)
          .where(or(...conditions))
          .limit(1)

        if (requesterUser.length === 0) {
          throw createError({
            statusCode: 404,
            statusMessage: '投稿人用户不存在'
          })
        }

        // 设置投稿人
        updateData.requesterId = requesterUser[0].id
      }
      // 如果投稿人为空值，则跳过处理，保持原有投稿人不变
    }

    // 更新歌曲
    const updatedSongResult = await db
      .update(songs)
      .set(updateData)
      .where(eq(songs.id, songId))
      .returning()

    if (updatedSongResult.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: '歌曲不存在'
      })
    }

    // 处理联合投稿人
    if (body.collaborators && Array.isArray(body.collaborators)) {
      // 获取现有联合投稿人
      const existingCollaborators = await db
        .select()
        .from(songCollaborators)
        .where(eq(songCollaborators.songId, songId))

      const existingCollaboratorUserIds = existingCollaborators.map((c) => c.userId)
      const newCollaboratorIds = body.collaborators

      // 需要添加的
      const toAdd = newCollaboratorIds.filter(
        (id: number) => !existingCollaboratorUserIds.includes(id)
      )
      // 需要删除的
      const toDelete = existingCollaborators.filter((c) => !newCollaboratorIds.includes(c.userId))

      // 执行添加
      for (const userId of toAdd) {
        // 检查用户是否存在
        const userExists = await db.select().from(users).where(eq(users.id, userId)).limit(1)
        if (userExists.length > 0) {
          const [newCollab] = await db
            .insert(songCollaborators)
            .values({
              songId: songId,
              userId: userId,
              status: 'ACCEPTED'
            })
            .returning()

          // 记录日志
          await db.insert(collaborationLogs).values({
            collaboratorId: newCollab.id,
            action: 'ADMIN_ADD',
            operatorId: user.id,
            ipAddress:
              (event.node.req.headers['x-forwarded-for'] as string) ||
              event.node.req.socket.remoteAddress
          })
        }
      }

      // 执行删除
      for (const collab of toDelete) {
        await db.delete(songCollaborators).where(eq(songCollaborators.id, collab.id))

        // 记录日志
        await db.insert(collaborationLogs).values({
          collaboratorId: collab.id,
          action: 'ADMIN_REMOVE',
          operatorId: user.id,
          ipAddress:
            (event.node.req.headers['x-forwarded-for'] as string) ||
            event.node.req.socket.remoteAddress
        })
      }
    }

    // 获取完整的歌曲信息（包含投稿人）
    const updatedSong = await db
      .select({
        id: songs.id,
        title: songs.title,
        artist: songs.artist,
        semester: songs.semester,
        musicPlatform: songs.musicPlatform,
        musicId: songs.musicId,
        cover: songs.cover,
        playUrl: songs.playUrl,
        requesterId: songs.requesterId,
        createdAt: songs.createdAt,
        updatedAt: songs.updatedAt,
        requester: {
          id: users.id,
          username: users.username,
          name: users.name
        }
      })
      .from(songs)
      .leftJoin(users, eq(songs.requesterId, users.id))
      .where(eq(songs.id, songId))
      .limit(1)

    // 清除歌曲相关缓存
    try {
      await cacheService.clearSongsCache()
      console.log('[Cache] 歌曲缓存已清除（更新歌曲）')
    } catch (cacheError) {
      console.error('[Cache] 清除歌曲缓存失败:', cacheError)
    }

    return {
      success: true,
      song: updatedSong[0]
    }
  } catch (error) {
    console.error('Update song error:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})
