import { prisma } from '../../models/schema'
import { createSongSelectedNotification } from '../../services/notificationService'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }
  
  if (user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能创建排期'
    })
  }
  
  const body = await readBody(event)
  
  if (!body.songId || !body.playDate) {
    throw createError({
      statusCode: 400,
      message: '歌曲ID和播放日期不能为空'
    })
  }
  
  try {
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
    
    // 检查是否已经为该歌曲创建过排期，如果有则删除旧的排期
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        songId: body.songId
      }
    })
    
    if (existingSchedule) {
      // 删除现有排期
      await prisma.schedule.delete({
        where: {
          id: existingSchedule.id
        }
      })
    }
    
    // 获取序号，如果未提供则查找当天最大序号+1
    let sequence = body.sequence || 1
    
    if (!body.sequence) {
      // 只保留日期部分，不保留时间
      const playDate = new Date(body.playDate)
      const startOfDay = new Date(playDate)
      startOfDay.setHours(0, 0, 0, 0)
      
      const endOfDay = new Date(playDate)
      endOfDay.setHours(23, 59, 59, 999)
      
      const sameDaySchedules = await prisma.schedule.findMany({
        where: {
          playDate: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        orderBy: {
          sequence: 'desc'
        },
        take: 1
      })
      
      if (sameDaySchedules.length > 0) {
        sequence = (sameDaySchedules[0].sequence || 0) + 1
      }
    }
    
    // 创建新排期 - 只保存日期，将时间设置为00:00:00
    const dateOnly = new Date(body.playDate)
    dateOnly.setHours(0, 0, 0, 0)
    
    const newSchedule = await prisma.schedule.create({
      data: {
        playDate: dateOnly,
        sequence,
        song: {
          connect: {
            id: body.songId
          }
        }
      },
      include: {
        song: true
      }
    })
    
    // 发送通知（异步，不阻塞响应）
    if (!existingSchedule) {
      // 只有首次安排时才发送通知
      createSongSelectedNotification(body.songId).catch(err => {
        console.error('发送歌曲被选中通知失败:', err)
      })
    }
    
    return {
      id: newSchedule.id,
      playDate: newSchedule.playDate,
      sequence: newSchedule.sequence,
      song: {
        id: newSchedule.song.id,
        title: newSchedule.song.title,
        artist: newSchedule.song.artist
      }
    }
  } catch (error: any) {
    console.error('创建排期失败:', error)
    throw createError({
      statusCode: 500,
      message: error.message || '创建排期失败'
    })
  }
}) 