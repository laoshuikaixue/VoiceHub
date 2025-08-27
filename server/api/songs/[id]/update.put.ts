import { z } from 'zod'
import { prisma } from '../../../models/schema'
import { CacheService } from '~/server/services/cacheService'

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
    const { title, artist, requester, semester, musicPlatform, musicId, cover } = body

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
      cover: cover || null
    }

    // 处理投稿人
    if ('requester' in body) {
      const requester = body.requester
      
      // 只有在传递有效投稿人信息时才更新
      if (requester && requester !== '' && requester !== 0) {
        // 查找投稿人用户
        const requesterUser = await prisma.user.findFirst({
          where: {
            OR: [
              { id: typeof requester === 'number' ? requester : undefined },
              { username: typeof requester === 'string' ? requester : undefined },
              { name: typeof requester === 'string' ? requester : undefined }
            ]
          }
        })

        if (!requesterUser) {
          throw createError({
            statusCode: 404,
            statusMessage: '投稿人用户不存在'
          })
        }

        // 设置投稿人
        updateData.requester = { connect: { id: requesterUser.id } }
      }
      // 如果投稿人为空值，则跳过处理，保持原有投稿人不变
    }

    // 更新歌曲
    const updatedSong = await prisma.song.update({
      where: { id: songId },
      data: updateData,
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

    // 清除歌曲列表缓存
    const { cache } = await import('~/server/utils/cache-helpers')
    await cache.deletePattern('songs:*')
    console.log('[Cache] 歌曲缓存已清除（更新歌曲）')
    
    return {
      success: true,
      song: updatedSong
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