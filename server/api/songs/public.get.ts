import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  try {
    // 获取当前日期
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // 获取已排期的歌曲
    const schedules = await prisma.schedule.findMany({
      where: {
        playDate: {
          gte: today // 只获取当前日期及以后的排期
        }
      },
      include: {
        song: {
          include: {
            requester: {
              select: {
                name: true
              }
            },
            _count: {
              select: {
                votes: true
              }
            }
          }
        }
      },
      orderBy: [
        { playDate: 'asc' }
        // 不使用sequence字段排序
      ]
    })
    
    // 转换数据格式
    const formattedSchedules = schedules.map(schedule => {
      // 创建一个新的日期对象，只保留日期部分，去掉时间
      const dateOnly = new Date(schedule.playDate)
      dateOnly.setHours(0, 0, 0, 0)
      
      return {
        id: schedule.id,
        playDate: dateOnly,
        // 添加默认的sequence值，以便前端代码可以使用
        sequence: schedule.sequence || 1,
        played: schedule.played || false,
        song: {
          id: schedule.song.id,
          title: schedule.song.title,
          artist: schedule.song.artist,
          requester: schedule.song.requester.name,
          voteCount: schedule.song._count.votes
        }
      }
    })
    
    return formattedSchedules
  } catch (error: any) {
    console.error('获取公共排期失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || '获取排期数据失败'
    })
  }
}) 