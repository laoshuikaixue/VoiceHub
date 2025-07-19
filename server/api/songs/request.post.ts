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
    
    // 检查期望的播出时段是否存在
    let preferredPlayTime = null
    if (body.preferredPlayTimeId) {
      // 检查系统设置是否允许选择播出时段
      const systemSettings = await prisma.systemSettings.findFirst()
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
        semester: getCurrentSemester(),
        cover: body.cover || null,
        musicUrl: body.musicUrl || null
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
    
// 获取当前学期
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