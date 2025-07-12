import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能获取歌曲列表'
    })
  }
  
  // 获取所有歌曲及其投票数
  const songs = await prisma.song.findMany({
    include: {
      requester: {
        select: {
          id: true,
          name: true
        }
      },
      votes: {
        select: {
          id: true
        }
      },
      _count: {
        select: {
          votes: true
        }
      }
    },
    orderBy: {
      votes: {
        _count: 'desc'
      }
    }
  })
  
  // 转换数据格式
  const formattedSongs = songs.map(song => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    requester: song.requester.name,
    voteCount: song._count.votes,
    played: song.played,
    playedAt: song.playedAt,
    semester: song.semester,
    createdAt: song.createdAt
  }))
  
  return formattedSongs
}) 