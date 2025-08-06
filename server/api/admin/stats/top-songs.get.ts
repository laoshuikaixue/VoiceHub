import { createError, defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  const query = getQuery(event)
  const semester = query.semester as string
  const limit = parseInt(query.limit as string) || 10

  try {
    // 构建查询条件
    const where = semester && semester !== 'all' ? { semester: semester } : {}

    // 获取热门歌曲排行
    const topSongs = await prisma.song.findMany({
      where,
      orderBy: {
        votes: {
          _count: 'desc'
        }
      },
      take: limit,
      include: {
        requester: {
          select: {
            name: true,
            username: true
          }
        },
        votes: true
      }
    })

    // 格式化数据
    const formattedData = topSongs.map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      voteCount: song.votes.length,
      requester: song.requester?.name || song.requester?.username || '未知用户'
    }))

    return formattedData
  } catch (error) {
    console.error('获取热门歌曲排行失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取热门歌曲排行失败'
    })
  }
})