import { db } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  try {
    // 使用认证中间件提供的用户信息
    const currentUser = event.context.user
    if (!currentUser) {
      throw createError({
        statusCode: 401,
        statusMessage: '未授权访问'
      })
    }

    // 检查是否为管理员、歌曲管理员或超级管理员
    const allowedRoles = ['ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(currentUser.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: '权限不足'
      })
    }

    // 获取用户ID
    const userId = parseInt(getRouterParam(event, 'id') as string)
    if (!userId || isNaN(userId)) {
      throw createError({
        statusCode: 400,
        statusMessage: '无效的用户ID'
      })
    }

    // 验证用户是否存在
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, username: true, grade: true, class: true }
    })

    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    // 获取用户投稿的歌曲
    const submittedSongs = await db.song.findMany({
      where: { requesterId: userId },
      select: {
        id: true,
        title: true,
        artist: true,
        createdAt: true,
        played: true,
        schedules: {
          select: {
            id: true,
            playDate: true,
            played: true
          }
        },
        _count: {
          select: {
            votes: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // 获取用户投票的歌曲
    const votedSongs = await db.vote.findMany({
      where: { userId: userId },
      include: {
        song: {
          select: {
            id: true,
            title: true,
            artist: true,
            played: true,
            schedules: {
              select: {
                id: true,
                playDate: true,
                played: true
              }
            },
            _count: {
              select: {
                votes: true
              }
            },
            requester: {
              select: {
                name: true,
                grade: true,
                class: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        grade: user.grade,
        class: user.class
      },
      submittedSongs: submittedSongs.map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        createdAt: song.createdAt,
        played: song.played,
        scheduled: song.schedules.length > 0,
        voteCount: song._count.votes
      })),
      votedSongs: votedSongs.map(vote => ({
        id: vote.song.id,
        title: vote.song.title,
        artist: vote.song.artist,
        played: vote.song.played,
        scheduled: vote.song.schedules.length > 0,
        voteCount: vote.song._count.votes,
        votedAt: vote.createdAt,
        requester: vote.song.requester
      }))
    }
  } catch (error) {
    console.error('获取用户歌曲信息失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '服务器内部错误'
    })
  }
})