import { db } from '~/drizzle/db'
import { songs, schedules, users, playTimes, votes } from '~/drizzle/schema'
import { eq, asc, count, and, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // Check user authentication and permissions
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized access'
    })
  }
  
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: 'Only song administrators and above can access full schedule data'
    })
  }
  
  const query = getQuery(event)
  const { date, playTimeId, includeDrafts = 'true' } = query
  
  try {
    // Build query conditions
    const conditions = []
    
    // Date filter
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
    
    // Play time filter
    if (playTimeId) {
      conditions.push(eq(schedules.playTimeId, parseInt(playTimeId as string)))
    }
    
    // Draft inclusion filter - by default include both drafts and published
    if (includeDrafts === 'false') {
      conditions.push(eq(schedules.isDraft, false))
    } else if (includeDrafts === 'only') {
      conditions.push(eq(schedules.isDraft, true))
    }
    // If includeDrafts === 'true' or not specified, include both (no filter needed)
    
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined
    
    // Get full schedule data including drafts
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
      
    // Get all users for name disambiguation
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      grade: users.grade,
      class: users.class
    })
      .from(users)
      
    // Create name to users mapping for disambiguation
    const nameToUsers = new Map()
    allUsers.forEach(user => {
      if (user.name) {
        if (!nameToUsers.has(user.name)) {
          nameToUsers.set(user.name, [])
        }
        nameToUsers.get(user.name).push(user)
      }
    })
      
    // Get vote counts for each song
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
    
    // Format response data
    const formattedSchedules = schedulesData.map(schedule => {
      const dateOnly = schedule.playDate
      
      // Handle requester name disambiguation
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
        // Draft state information
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
    
    // Group by date for better organization
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
    
    // Convert to array and sort by date
    const dateGroups = Object.values(groupedByDate).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    // Summary statistics
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
    console.error('Get full schedule data failed:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to retrieve full schedule data'
    })
  }
})