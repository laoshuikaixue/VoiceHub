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
      // 解析输入的日期字符串，确保使用UTC时间
      const inputDateStr = typeof body.playDate === 'string' ? body.playDate : body.playDate.toISOString()
      
      // 提取年月日部分（不管输入格式如何）
      const dateParts = inputDateStr.split('T')[0].split('-')
      const year = parseInt(dateParts[0])
      const month = parseInt(dateParts[1]) - 1 // 月份从0开始
      const day = parseInt(dateParts[2])
      
      // 创建UTC日期，只包含日期部分
      const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
      const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999))
      
      console.log('查询当天排期范围:', {
        输入日期: body.playDate,
        开始时间: startOfDay.toISOString(),
        结束时间: endOfDay.toISOString()
      })
      
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
    
    // 解析输入的日期字符串，确保使用UTC时间
    const inputDateStr = typeof body.playDate === 'string' ? body.playDate : body.playDate.toISOString()
    
    // 提取年月日部分（不管输入格式如何）
    const dateParts = inputDateStr.split('T')[0].split('-')
    const year = parseInt(dateParts[0])
    const month = parseInt(dateParts[1]) - 1 // 月份从0开始
    const day = parseInt(dateParts[2])
    
    // 创建UTC日期，只包含日期部分
    const playDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
    
    // 创建排期
    const schedule = await prisma.schedule.create({
      data: {
        songId: body.songId,
        playDate: playDate,
        sequence: sequence,
        playTimeId: body.playTimeId || null
      },
      include: {
        song: {
          select: {
            id: true,
            title: true,
            artist: true,
            requesterId: true
          }
        }
      }
    })
    
    // 创建通知
    await createSongSelectedNotification(schedule.song.requesterId, schedule.song.id, {
      title: schedule.song.title,
      artist: schedule.song.artist,
      playDate: schedule.playDate
    })
    
    return schedule
  } catch (error: any) {
    console.error('创建排期失败:', error)
    throw createError({
      statusCode: 500,
      message: error.message || '创建排期失败'
    })
  }
}) 