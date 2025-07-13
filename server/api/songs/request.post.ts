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
  
  // 处理投票请求
  if (body.isVoteOnly && body.songId) {
    return await handleVote(body.songId, user.id)
  }
  
  // 处理点歌请求
  if (!body.title || !body.artist) {
    throw createError({
      statusCode: 400,
      message: '歌曲名称和艺术家不能为空'
    })
  }
  
  // 获取当前学期标识（这里简单使用年份+学期作为标识）
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const semester = month >= 2 && month <= 7 ? `${year}-春季` : `${year}-秋季`
  
  // 检查该歌曲在本学期是否已播放过
  const playedSong = await prisma.song.findFirst({
    where: {
      title: body.title,
      artist: body.artist,
      semester: semester,
      played: true
    }
  })
  
  if (playedSong) {
    throw createError({
      statusCode: 400,
      message: '该歌曲在本学期已经播放过，不能重复点播'
    })
  }
  
  // 查找是否已有相同的歌曲请求（未播放）
  const existingSong = await prisma.song.findFirst({
    where: {
      title: {
        equals: body.title,
        mode: 'insensitive'  // 不区分大小写
      },
      artist: {
        equals: body.artist,
        mode: 'insensitive'  // 不区分大小写
      },
      played: false
    }
  })
  
  // 如果歌曲已存在，则增加投票
  if (existingSong) {
    return await handleVote(existingSong.id, user.id)
  } else {
    // 创建新歌曲
    const newSong = await prisma.song.create({
      data: {
        title: body.title,
        artist: body.artist,
        semester: semester,
        requester: {
          connect: {
            id: user.id
          }
        },
        votes: {
          create: {
            user: {
              connect: {
                id: user.id
              }
            }
          }
        }
      }
    })
    
    return {
      message: '点歌成功',
      song: {
        id: newSong.id,
        title: newSong.title,
        artist: newSong.artist,
        voteCount: 1
      }
    }
  }
})

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