import { createError, defineEventHandler } from 'h3'
import { prisma } from '../../models/schema'
import { executeWithPool } from '~/server/utils/db-pool'

export default defineEventHandler(async (event) => {
  try {
    // 检查用户认证
    const user = event.context.user

    if (!user) {
      throw createError({
        statusCode: 401,
        message: '需要登录才能获取歌曲列表'
      })
    }

    console.log(`[Songs API] 用户 ${user.name} 请求歌曲列表`)

    // 使用连接池执行数据库操作
    const result = await executeWithPool(async () => {
      // 获取所有歌曲及其投票数
      const songs = await prisma.song.findMany({
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              grade: true,
              class: true
            }
          },
          votes: {
            select: {
              id: true,
              userId: true
            }
          },
          _count: {
            select: {
              votes: true
            }
          },
          schedules: {
            select: {
              id: true
            }
          },
          // 包含期望播放时段信息
          preferredPlayTime: true
        },
        orderBy: [
          {
            votes: {
              _count: 'desc'
            }
          },
          {
            createdAt: 'asc'  // 投票数相同时，按提交时间排序（较早提交的优先）
          }
        ]
      })

      // 获取所有用户的姓名列表，用于检测同名用户
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          grade: true,
          class: true
        }
      })

      // 创建姓名到用户数组的映射
      const nameToUsers = new Map()
      users.forEach(user => {
        if (user.name) {
          if (!nameToUsers.has(user.name)) {
            nameToUsers.set(user.name, [])
          }
          nameToUsers.get(user.name).push(user)
        }
      })

      // 转换数据格式
      const formattedSongs = songs.map(song => {
        // 处理投稿人姓名，如果是同名用户则添加后缀
        let requesterName = song.requester.name || '未知用户'

        // 检查是否有同名用户
        const sameNameUsers = nameToUsers.get(requesterName)
        if (sameNameUsers && sameNameUsers.length > 1) {
          const requesterWithGradeClass = song.requester

          // 如果有年级信息，则添加年级后缀
          if (requesterWithGradeClass.grade) {
            // 检查同一个年级是否有同名
            const sameGradeUsers = sameNameUsers.filter((u: {grade?: string, class?: string}) => u.grade === requesterWithGradeClass.grade)

            if (sameGradeUsers.length > 1 && requesterWithGradeClass.class) {
              // 同一个年级有同名，添加班级后缀
              requesterName = `${requesterName}（${requesterWithGradeClass.grade} ${requesterWithGradeClass.class}）`
            } else {
              // 只添加年级后缀
              requesterName = `${requesterName}（${requesterWithGradeClass.grade}）`
            }
          }
        }

        // 检查当前用户是否已对该歌曲投票
        const voted = song.votes.some(vote => vote.userId === user.id)

        // 创建基本歌曲对象
        const songObject: any = {
          id: song.id,
          title: song.title,
          artist: song.artist,
          requester: requesterName,
          requesterId: song.requester.id,
          voteCount: song._count.votes,
          played: song.played,
          playedAt: song.playedAt,
          semester: song.semester,
          createdAt: song.createdAt,
          requestedAt: song.createdAt.toLocaleString(), // 添加请求时间的格式化字符串
          scheduled: song.schedules.length > 0, // 添加是否已排期的标志
          voted: voted, // 添加当前用户是否已投票的标志
          cover: song.cover || null, // 添加封面字段
          musicPlatform: song.musicPlatform || null, // 添加音乐平台字段
          musicId: song.musicId || null // 添加音乐ID字段
        }

        // 只对管理员用户添加期望播放时段相关字段
        if (user.role === 'ADMIN') {
          songObject.preferredPlayTimeId = song.preferredPlayTimeId

          // 如果有期望播放时段，添加相关信息
          if (song.preferredPlayTime) {
            songObject.preferredPlayTime = {
              id: song.preferredPlayTime.id,
              name: song.preferredPlayTime.name,
              startTime: song.preferredPlayTime.startTime,
              endTime: song.preferredPlayTime.endTime,
              enabled: song.preferredPlayTime.enabled
            }
          }
        }

        return songObject
      })

      return formattedSongs
    }, 'getSongsList')

    console.log(`[Songs API] 成功返回 ${result.length} 首歌曲`)
    return result

  } catch (error: any) {
    console.error('[Songs API] 获取歌曲列表失败:', error)

    // 检查是否是数据库连接错误
    const isDbError = error.message?.includes('ECONNRESET') ||
                     error.message?.includes('ENOTFOUND') ||
                     error.message?.includes('ETIMEDOUT') ||
                     error.message?.includes('Connection terminated') ||
                     error.message?.includes('Connection lost')

    if (isDbError) {
      console.log('[Songs API] 检测到数据库连接错误')
    }

    if (error.statusCode) {
      throw error
    } else {
      throw createError({
        statusCode: isDbError ? 503 : 500,
        message: isDbError ? '数据库连接暂时不可用，请稍后重试' : '获取歌曲列表失败，请稍后重试'
      })
    }
  }
})