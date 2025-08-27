import { z } from 'zod'
import { db } from '~/drizzle/db'
import { CacheService } from '~/server/services/cacheService'

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
    const { title, artist, requester, semester, musicPlatform, musicId, cover } = body

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
        requesterUser = await db.user.findUnique({
          where: { id: parsedId }
        })
      } else {
        // 如果不是数字ID，按用户名或姓名查找
        requesterUser = await db.user.findFirst({
          where: {
            OR: [
              { username: String(requester) },
              { name: String(requester) }
            ]
          }
        })
      }
      
      requesterId = requesterUser?.id || null
    }

    // 检查歌曲是否已存在
    const existingSong = await db.song.findFirst({
      where: {
        title: title.trim(),
        artist: artist.trim(),
        requesterId
      }
    })

    if (existingSong) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Song already exists'
      })
    }

    // 创建歌曲
    const newSong = await db.song.create({
      data: {
        title: title.trim(),
        artist: artist.trim(),
        requesterId,
        semester: semester || null,
        musicPlatform: musicPlatform || null,
        musicId: musicId || null,
        cover: cover || null
      },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            name: true
          }
        }
      }
    })

    // 清除歌曲数量缓存
    const cacheService = CacheService.getInstance()
    try {
      await cacheService.clearSongsCache()
    } catch (error) {
      console.error('清除歌曲缓存失败:', error)
    }
    
    return {
      success: true,
      song: newSong
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