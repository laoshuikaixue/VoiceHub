import { prisma } from '../../models/schema'
import { createSongVotedNotification } from '../../services/notificationService'
import { executeWithPool } from '~/server/utils/db-pool'
import { CacheService } from '~/server/services/cacheService'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

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
        },
        include: {
          schedules: true
        }
      })

      if (!song) {
        throw createError({
          statusCode: 404,
          message: '歌曲不存在'
        })
      }

      // 检查歌曲是否已播放
      if (song.played) {
        throw createError({
          statusCode: 400,
          message: '该歌曲已播放，无法进行投票操作'
        })
      }

      // 检查歌曲是否已排期
      if (song.schedules && song.schedules.length > 0) {
        throw createError({
          statusCode: 400,
          message: '该歌曲已排期，无法进行投票操作'
        })
      }

      // 检查是否是自己的歌曲
      if (song.requesterId === user.id) {
        throw createError({
          statusCode: 400,
          message: '不允许自己给自己投票'
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

        // 清除歌曲列表缓存和统计缓存
        const cacheService = CacheService.getInstance()
        await cacheService.clearSongsCache()
        await cacheService.clearStatsCache()
        console.log('[Cache] 歌曲缓存和统计缓存已清除（取消投票）')

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

        // 创建新的投票（带ID冲突重试机制）
        let newVote
        try {
          newVote = await prisma.vote.create({
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
        } catch (voteError) {
          // 检查是否为唯一约束冲突错误（通常是序列问题）
          if (voteError instanceof PrismaClientKnownRequestError && voteError.code === 'P2002') {
            console.log('检测到投票ID唯一约束冲突，尝试重置序列...')
            
            try {
              // 重置Vote表的id序列
              await prisma.$executeRaw`
                SELECT setval(pg_get_serial_sequence('Vote', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM "Vote"
              `
              
              console.log('Vote表序列重置成功，重试创建投票...')
              
              // 重试创建投票
              newVote = await prisma.vote.create({
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
            } catch (retryError) {
              console.error('Vote表序列重置后重试仍失败:', retryError)
              throw voteError // 抛出原始错误
            }
          } else {
            throw voteError // 非序列问题，直接抛出
          }
        }

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

        // 清除歌曲列表缓存和统计缓存
        const cacheService = CacheService.getInstance()
        await cacheService.clearSongsCache()
        await cacheService.clearStatsCache()
        console.log('[Cache] 歌曲缓存和统计缓存已清除（投票）')

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