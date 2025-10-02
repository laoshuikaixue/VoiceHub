import { db } from '~/drizzle/db'
import { songs, schedules, users, playTimes, votes } from '~/drizzle/schema'
import { eq, asc, count, and, or, gte, lt } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查用户身份验证和权限
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }
  
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有歌曲管理员及以上权限才能访问完整排期数据'
    })
  }
  
  const query = getQuery(event)
  const { date, playTimeId, includeDrafts = 'true' } = query
  
  try {
    // 构建查询条件
    const conditions = []
    
    // 日期过滤
    if (date) {
      const targetDate = new Date(date as string)
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1)
      
      conditions.push(
        and(
          gte(schedules.playDate, startOfDay),
          lt(schedules.playDate, endOfDay)
        )
      )
    }
    
    // 播放时间过滤
    if (playTimeId) {
      conditions.push(eq(schedules.playTimeId, parseInt(playTimeId as string)))
    }
    
    // 草稿包含过滤 - 默认包含草稿和已发布的排期
    if (includeDrafts === 'false') {
      conditions.push(eq(schedules.isDraft, false))
    } else if (includeDrafts === 'only') {
      conditions.push(eq(schedules.isDraft, true))
    }
    // 如果 includeDrafts === 'true' 或未指定，则包含两者（无需过滤）
    
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined
    
    // 获取完整的排期数据，包括草稿
    const schedulesData = await db.select({
      id: schedules.id,
      createdAt: schedules.createdAt,
      updatedAt: schedules.updatedAt,
      playDate: schedules.playDate,
      sequence: schedules.sequence,
      played: schedules.played,
      playTimeId: schedules.playTimeId,
      isDraft: schedules.isDraft,
      publishedAt: schedules.publishedAt,
      songId: schedules.songId,
      songTitle: songs.title,
      songArtist: songs.artist,
      songRequesterId: songs.requesterId,
      songPlayed: songs.played,
      songCover: songs.cover,
      songMusicPlatform: songs.musicPlatform,
      songMusicId: songs.musicId,
      songSemester: songs.semester,
      songCreatedAt: songs.createdAt,
      requesterName: users.name,
      requesterGrade: users.grade,
      requesterClass: users.class,
      playTimeName: playTimes.name,
      playTimeStartTime: playTimes.startTime,
      playTimeEndTime: playTimes.endTime,
      playTimeEnabled: playTimes.enabled
    })
      .from(schedules)
      .innerJoin(songs, eq(schedules.songId, songs.id))
      .innerJoin(users, eq(songs.requesterId, users.id))
      .leftJoin(playTimes, eq(schedules.playTimeId, playTimes.id))
      .where(whereCondition)
      .orderBy(
        asc(schedules.playDate),
        asc(schedules.sequence),
        asc(schedules.createdAt)
      )
      
    // 获取所有用户用于姓名消歧
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      grade: users.grade,
      class: users.class
    })
      .from(users)
      
    // 创建姓名到用户的映射用于消歧
    const nameToUsers = new Map()
    allUsers.forEach(user => {
      if (user.name) {
        if (!nameToUsers.has(user.name)) {
          nameToUsers.set(user.name, [])
        }
        nameToUsers.get(user.name).push(user)
      }
    })
      
    // 获取每首歌的投票数
    const songIds = schedulesData.map(s => s.songId)
    const voteCounts = songIds.length > 0 ? await Promise.all(
      songIds.map(async (songId) => {
        const voteCountResult = await db.select({ count: count() })
          .from(votes)
          .where(eq(votes.songId, songId))
        return { songId, count: voteCountResult[0].count }
      })
    ) : []
    
    const voteCountMap = new Map(voteCounts.map(v => [v.songId, v.count]))
    
    // 格式化响应数据
    const formattedSchedules = schedulesData.map(schedule => {
      const dateOnly = schedule.playDate
      
      // 处理投稿人姓名消歧
      let requesterName = schedule.requesterName || 'Unknown User'
      
      const sameNameUsers = nameToUsers.get(requesterName)
      if (sameNameUsers && sameNameUsers.length > 1) {
        if (schedule.requesterGrade) {
          const sameGradeUsers = sameNameUsers.filter((u: {id: number, name: string | null, grade: string | null, class: string | null}) => 
            u.grade === schedule.requesterGrade
          )
          
          if (sameGradeUsers.length > 1 && schedule.requesterClass) {
            requesterName = `${requesterName}（${schedule.requesterGrade} ${schedule.requesterClass}）`
          } else {
            requesterName = `${requesterName}（${schedule.requesterGrade}）`
          }
        }
      }
        
      return {
        id: schedule.id,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
        playDate: dateOnly.toISOString().split('T')[0],
        sequence: schedule.sequence || 1,
        played: schedule.played || false,
        playTimeId: schedule.playTimeId,
        // 草稿状态信息
        isDraft: schedule.isDraft || false,
        publishedAt: schedule.publishedAt,
        status: schedule.isDraft ? 'draft' : 'published',
        playTime: schedule.playTimeName ? {
          id: schedule.playTimeId,
          name: schedule.playTimeName,
          startTime: schedule.playTimeStartTime,
          endTime: schedule.playTimeEndTime,
          enabled: schedule.playTimeEnabled
        } : null,
        song: {
          id: schedule.songId,
          title: schedule.songTitle,
          artist: schedule.songArtist,
          requester: requesterName,
          requesterId: schedule.songRequesterId,
          voteCount: voteCountMap.get(schedule.songId) || 0,
          played: schedule.songPlayed || false,
          cover: schedule.songCover || null,
          musicPlatform: schedule.songMusicPlatform || null,
          musicId: schedule.songMusicId || null,
          semester: schedule.songSemester || null,
          createdAt: schedule.songCreatedAt
        }
      }
    })
    
    // 按日期分组以便更好地组织
    const groupedByDate = {}
    formattedSchedules.forEach(schedule => {
      const date = schedule.playDate
      if (!groupedByDate[date]) {
        groupedByDate[date] = {
          date,
          schedules: [],
          totalCount: 0,
          draftCount: 0,
          publishedCount: 0
        }
      }
      
      groupedByDate[date].schedules.push(schedule)
      groupedByDate[date].totalCount++
      
      if (schedule.isDraft) {
        groupedByDate[date].draftCount++
      } else {
        groupedByDate[date].publishedCount++
      }
    })
    
    // 转换为数组并按日期排序
    const dateGroups = Object.values(groupedByDate).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    // 汇总统计
    const summary = {
      totalSchedules: formattedSchedules.length,
      draftCount: formattedSchedules.filter(s => s.isDraft).length,
      publishedCount: formattedSchedules.filter(s => !s.isDraft).length,
      dateRange: {
        startDate: dateGroups.length > 0 ? dateGroups[0].date : null,
        endDate: dateGroups.length > 0 ? dateGroups[dateGroups.length - 1].date : null
      },
      playTimeFilter: playTimeId ? parseInt(playTimeId as string) : null,
      includeDrafts: includeDrafts as string
    }
    
    return {
      success: true,
      data: {
        summary,
        schedules: formattedSchedules,
        groupedByDate: dateGroups
      }
    }
  } catch (error: any) {
    console.error('获取完整排期数据失败:', error)
    throw createError({
      statusCode: 500,
      message: error.message || '获取完整排期数据失败'
    })
  }
})