import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { schedules, songs, users } from '~/drizzle/schema'
import { desc, eq } from 'drizzle-orm'

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
  const limit = parseInt(query.limit as string) || 10

  try {
    // 获取最近的活动记录
    const activities: Array<{
      id: string
      type: string
      title: string
      description: string
      createdAt: Date
    }> = []

    // 获取最近的歌曲活动
    const recentSongs = await db
      .select({
        id: songs.id,
        title: songs.title,
        createdAt: songs.createdAt,
        requesterName: users.name,
        requesterUsername: users.username
      })
      .from(songs)
      .leftJoin(users, eq(songs.requesterId, users.id))
      .orderBy(desc(songs.createdAt))
      .limit(5)

    recentSongs.forEach((song) => {
      activities.push({
        id: `song-${song.id}`,
        type: 'song',
        title: '新歌曲投稿',
        description: `${song.requesterName || song.requesterUsername || '用户'} 投稿了《${song.title}》`,
        createdAt: song.createdAt
      })
    })

    // 移除了新用户注册活动记录

    // 获取最近的排期活动
    const recentSchedules = await db
      .select({
        id: schedules.id,
        createdAt: schedules.createdAt,
        songTitle: songs.title,
        songArtist: songs.artist
      })
      .from(schedules)
      .leftJoin(songs, eq(schedules.songId, songs.id))
      .orderBy(desc(schedules.createdAt))
      .limit(3)

    recentSchedules.forEach((schedule) => {
      activities.push({
        id: `schedule-${schedule.id}`,
        type: 'schedule',
        title: '排期更新',
        description: `《${schedule.songTitle}》已安排到播放排期`,
        createdAt: schedule.createdAt
      })
    })

    // 按时间排序并限制数量
    const sortedActivities = activities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)

    return {
      activities: sortedActivities,
      total: sortedActivities.length
    }
  } catch (error) {
    console.error('获取活动记录失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取活动记录失败'
    })
  }
})
