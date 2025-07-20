import { prisma } from '../../models/schema'
import { createSongVotedNotification } from '../../services/notificationService'
import { executeWithPool } from '~/server/utils/db-pool'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能投票'
    })
  }
  
  const body = await readBody(event)
  
  if (!body.songId) {
    throw createError({
      statusCode: 400,
      message: '歌曲ID不能为空'
    })
  }
  
  const isUnvote = body.unvote === true
  
  try {
    return await executeWithPool(async () => {
      // 检查歌曲是否存在
      const song = await prisma.song.findUnique({
        where: {
          id: body.songId
        }
      })

      if (!song) {
        throw createError({
          statusCode: 404,
          message: '歌曲不存在'
        })
      }

      // 检查用户是否已经投过票
      const existingVote = await prisma.vote.findFirst({
        where: {
          songId: body.songId,
          userId: user.id
        }
      })

      if (isUnvote) {
        // 撤销投票逻辑
        if (!existingVote) {
          throw createError({
            statusCode: 400,
            message: '你尚未为这首歌投票，无法取消'
          })
        }

        // 删除投票
        await prisma.vote.delete({
          where: {
            id: existingVote.id
          }
        })

        // 获取投票总数
        const voteCount = await prisma.vote.count({
          where: {
            songId: body.songId
          }
        })

        return {
          success: true,
          message: '取消投票成功',
          song: {
            id: song.id,
            title: song.title,
            artist: song.artist,
            voteCount
          }
        }
      } else {
        // 正常投票逻辑
        if (existingVote) {
          throw createError({
            statusCode: 400,
            message: '你已经为这首歌投过票了'
          })
        }

        // 创建新的投票
        const newVote = await prisma.vote.create({
          data: {
            song: {
              connect: {
                id: body.songId
              }
            },
            user: {
              connect: {
                id: user.id
              }
            }
          }
        })

        // 获取投票总数
        const voteCount = await prisma.vote.count({
          where: {
            songId: body.songId
          }
        })

        // 发送通知（异步，不阻塞响应）
        if (song.requesterId !== user.id) {
          createSongVotedNotification(body.songId, user.id).catch(() => {
            // 发送通知失败不影响主流程
          })
        }

        return {
          success: true,
          message: '投票成功',
          song: {
            id: song.id,
            title: song.title,
            artist: song.artist,
            voteCount
          }
        }
      }
    }, 'songVote')
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    } else {
      throw createError({
        statusCode: 500,
        message: '操作失败，请稍后重试'
      })
    }
  }
})