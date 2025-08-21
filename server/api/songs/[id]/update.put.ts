import { z } from 'zod'
import { prisma } from '../../../models/schema'

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

    // 如果提供了投稿人信息，则更新投稿人
    if (requester !== undefined && requester !== null) {
      if (requester === '' || requester === 0) {
        // 清空投稿人
        updateData.requesterId = null
      } else {
        // 查找投稿人
        let requesterUser = null
        
        // 如果是数字ID，直接查找
        if (typeof requester === 'number' || !isNaN(parseInt(requester))) {
          requesterUser = await prisma.user.findUnique({
            where: { id: parseInt(requester) }
          })
        } else {
          // 如果不是数字ID，按用户名或姓名查找
          requesterUser = await prisma.user.findFirst({
            where: {
              OR: [
                { username: String(requester) },
                { name: String(requester) }
              ]
            }
          })
        }
        
        if (!requesterUser) {
          throw createError({
            statusCode: 400,
            statusMessage: '找不到指定的投稿人'
          })
        }
        
        updateData.requesterId = requesterUser.id
      }
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