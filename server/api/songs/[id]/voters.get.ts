import { createError, defineEventHandler, getRouterParam } from 'h3'
import { prisma } from '../../../models/schema'
import { executeWithPool } from '~/server/utils/db-pool'

export default defineEventHandler(async (event) => {
  try {
    // 检查用户认证
    const user = event.context.user

    if (!user) {
      throw createError({
        statusCode: 401,
        message: '需要登录才能查看投票人员'
      })
    }

    // 检查管理员权限
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        message: '只有管理员才能查看投票人员列表'
      })
    }

    // 获取歌曲ID
    const songId = parseInt(getRouterParam(event, 'id') || '0')
    
    if (!songId || isNaN(songId)) {
      throw createError({
        statusCode: 400,
        message: '无效的歌曲ID'
      })
    }

    return await executeWithPool(async () => {
      // 检查歌曲是否存在
      const song = await prisma.song.findUnique({
        where: { id: songId },
        select: {
          id: true,
          title: true,
          artist: true
        }
      })

      if (!song) {
        throw createError({
          statusCode: 404,
          message: '歌曲不存在'
        })
      }

      // 获取投票人员列表
      const votes = await prisma.vote.findMany({
        where: {
          songId: songId
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              grade: true,
              class: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc' // 按投票时间排序
        }
      })

      // 处理用户名显示逻辑，总是显示年级和班级信息
      const votersWithDisplayName = votes.map(vote => {
        let displayName = vote.user.name || vote.user.username

        // 如果有年级信息，添加年级和班级后缀
        if (vote.user.grade) {
          if (vote.user.class) {
            displayName = `${displayName}（${vote.user.grade} ${vote.user.class}）`
          } else {
            displayName = `${displayName}（${vote.user.grade}）`
          }
        }

        return {
          id: vote.user.id,
          name: displayName,
          votedAt: vote.createdAt
        }
      })

      return {
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist
        },
        voters: votersWithDisplayName,
        totalVotes: votersWithDisplayName.length
      }
    })

  } catch (error: any) {
    console.error('获取投票人员列表失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      message: '获取投票人员列表失败'
    })
  }
})