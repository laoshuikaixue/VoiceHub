import { prisma } from '../../models/schema'
import { createSongVotedNotification } from '../../services/notificationService'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能点歌'
    })
  }
  
  const body = await readBody(event)
  
  if (!body.title || !body.artist) {
    throw createError({
      statusCode: 400,
      message: '歌曲名称和艺术家不能为空'
    })
  }
  
  try {
    // 检查是否已有相同歌曲
  const existingSong = await prisma.song.findFirst({
    where: {
      title: {
        equals: body.title,
          mode: 'insensitive'
      },
      artist: {
        equals: body.artist,
          mode: 'insensitive'
        }
    }
  })
  
  if (existingSong) {
      throw createError({
        statusCode: 400,
        message: `《${body.title}》已经在列表中，不能重复投稿`
      })
    }
    
    // 检查投稿限额
    const systemSettings = await prisma.systemSettings.findFirst()
    if (systemSettings?.enableSubmissionLimit) {
      const now = new Date()
      
      // 检查每日限额
      if (systemSettings.dailySubmissionLimit && systemSettings.dailySubmissionLimit > 0) {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
        
        const dailyCount = await prisma.song.count({
          where: {
            requesterId: user.id,
            createdAt: {
              gte: startOfDay,
              lt: endOfDay
            }
          }
        })
        
        if (dailyCount >= systemSettings.dailySubmissionLimit) {
          throw createError({
            statusCode: 400,
            message: `每日投稿限额为${systemSettings.dailySubmissionLimit}首，您今日已达到限额`
          })
        }
      }
      
      // 检查每周限额
      if (systemSettings.weeklySubmissionLimit && systemSettings.weeklySubmissionLimit > 0) {
        const startOfWeek = new Date(now)
        const dayOfWeek = now.getDay()
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 周一为一周开始
        startOfWeek.setDate(now.getDate() - daysToSubtract)
        startOfWeek.setHours(0, 0, 0, 0)
        
        const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)
        
        const weeklyCount = await prisma.song.count({
          where: {
            requesterId: user.id,
            createdAt: {
              gte: startOfWeek,
              lt: endOfWeek
            }
          }
        })
        
        if (weeklyCount >= systemSettings.weeklySubmissionLimit) {
          throw createError({
            statusCode: 400,
            message: `每周投稿限额为${systemSettings.weeklySubmissionLimit}首，您本周已达到限额`
          })
        }
      }
    }
    
    // 检查期望的播出时段是否存在
    let preferredPlayTime = null
    if (body.preferredPlayTimeId) {
      // 检查系统设置是否允许选择播出时段
      if (!systemSettings?.enablePlayTimeSelection) {
        throw createError({
          statusCode: 400,
          message: '播出时段选择功能未启用'
        })
      }
      
      // 检查播出时段是否存在且已启用
      preferredPlayTime = await prisma.playTime.findUnique({
        where: {
          id: body.preferredPlayTimeId,
          enabled: true
        }
      })
      
      if (!preferredPlayTime) {
        throw createError({
          statusCode: 400,
          message: '选择的播出时段不存在或未启用'
        })
      }
    }
    
    // 创建歌曲
    const song = await prisma.song.create({
      data: {
        title: body.title,
        artist: body.artist,
        requesterId: user.id,
        preferredPlayTimeId: preferredPlayTime?.id || null,
        semester: await getCurrentSemesterName(),
        cover: body.cover || null,
        musicPlatform: body.musicPlatform || null,
        musicId: body.musicId ? String(body.musicId) : null
      }
    })
    
    return song
  } catch (error: any) {
    console.error('点歌失败:', error)

    if (error.statusCode) {
      throw error
    } else {
      throw createError({
        statusCode: 500,
        message: '点歌失败，请稍后重试'
      })
        }
      }
    })

// 获取当前学期名称（从数据库）
async function getCurrentSemesterName() {
  try {
    // 获取当前活跃的学期
    const currentSemester = await prisma.semester.findFirst({
      where: {
        isActive: true
      }
    })

    if (currentSemester) {
      return currentSemester.name
    }

    // 如果没有活跃学期，使用默认逻辑
    return getCurrentSemester()
  } catch (error) {
    console.error('获取当前学期失败，使用默认逻辑:', error)
    return getCurrentSemester()
  }
}

// 获取当前学期（后备函数）
function getCurrentSemester() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  
  // 假设上学期为9-2月，下学期为3-8月
  const term = month >= 3 && month <= 8 ? '下' : '上'
  
  // 如果是上学期（9-12月），年份应该是当前年份
  // 如果是上学期（1-2月），年份应该是前一年
  // 如果是下学期（3-8月），年份应该是当前年份
  const academicYear = month >= 9 ? year : (month <= 2 ? year - 1 : year)
  
  return `${academicYear}-${academicYear + 1}学年${term}学期`
}

// 处理投票逻辑
async function handleVote(songId: number, userId: number) {
  // 检查歌曲是否存在
  const song = await prisma.song.findUnique({
    where: {
      id: songId
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
      songId: songId,
      userId: userId
    }
  })
  
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
          id: songId
        }
      },
      user: {
        connect: {
          id: userId
        }
      }
    }
  })
  
  // 获取投票总数
  const voteCount = await prisma.vote.count({
    where: {
      songId: songId
    }
  })
  
  // 发送通知（异步，不阻塞响应）
  if (song.requesterId !== userId) {
    createSongVotedNotification(songId, userId).catch(err => {
      console.error('发送投票通知失败:', err)
    })
  }
  
  return {
    message: '投票成功',
    song: {
      id: song.id,
      title: song.title,
      artist: song.artist,
      voteCount
    }
  }
}