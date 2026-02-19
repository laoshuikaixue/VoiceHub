import { db } from '~/drizzle/db'
import { playTimes, schedules, songs, users, votes, songReplayRequests } from '~/drizzle/schema'
import { and, asc, count, eq } from 'drizzle-orm'
import { createSongSelectedNotification } from '~~/server/services/notificationService'
import { cacheService } from '~~/server/services/cacheService'
import { getBeijingTimestamp } from '~/utils/timeUtils'
import { getClientIP } from '~~/server/utils/ip-utils'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
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
      message: '只有歌曲管理员及以上权限才能发布排期'
    })
  }

  const body = await readBody(event)

  if (!body.scheduleId) {
    throw createError({
      statusCode: 400,
      message: '排期ID不能为空'
    })
  }

  try {
    // 检查草稿是否存在
    const draftResult = await db
      .select({
        id: schedules.id,
        songId: schedules.songId,
        playDate: schedules.playDate,
        sequence: schedules.sequence,
        playTimeId: schedules.playTimeId,
        isDraft: schedules.isDraft,
        publishedAt: schedules.publishedAt,
        song: {
          id: songs.id,
          title: songs.title,
          artist: songs.artist,
          requesterId: songs.requesterId
        }
      })
      .from(schedules)
      .innerJoin(songs, eq(schedules.songId, songs.id))
      .where(
        and(
          eq(schedules.id, body.scheduleId),
          eq(schedules.isDraft, true) // 确保是草稿状态
        )
      )
      .limit(1)

    const draft = draftResult[0]

    if (!draft) {
      throw createError({
        statusCode: 404,
        message: '找不到指定的排期草稿'
      })
    }

    // 更新草稿为已发布状态
    const publishedAt = new Date(getBeijingTimestamp())

    const publishResult = await db
      .update(schedules)
      .set({
        isDraft: false,
        publishedAt: publishedAt,
        updatedAt: publishedAt
      })
      .where(eq(schedules.id, body.scheduleId))
      .returning()

    const publishedSchedule = publishResult[0]

    if (!publishedSchedule) {
      throw createError({
        statusCode: 500,
        message: '发布排期失败'
      })
    }

    // 获取客户端IP地址
    const clientIP = getClientIP(event)

    // 发布后发送通知（这是与草稿保存的主要区别）
    await createSongSelectedNotification(
      draft.song.requesterId,
      draft.song.id,
      {
        title: draft.song.title,
        artist: draft.song.artist,
        playDate: draft.playDate
      },
      clientIP
    )

    // 将该歌曲的所有待处理重播申请标记为已完成
    const updatedRequests = await db
      .update(songReplayRequests)
      .set({
        status: 'FULFILLED',
        updatedAt: new Date()
      })
      .where(
        and(eq(songReplayRequests.songId, draft.song.id), eq(songReplayRequests.status, 'PENDING'))
      )
      .returning()

    if (updatedRequests.length > 0) {
      console.log(`发布排期：将 ${updatedRequests.length} 个重播申请标记为 FULFILLED`)
    }

    // 清除相关缓存
    try {
      await cacheService.clearSchedulesCache()
      await cacheService.clearSongsCache()
      console.log('[Cache] 排期缓存和歌曲列表缓存已清除（发布排期）')
    } catch (cacheError) {
      console.error('[Cache] 清除缓存失败:', cacheError)
    }

    // 重新缓存完整的排期列表
    try {
      // 获取所有已发布的排期数据
      const schedulesData = await db
        .select({
          id: schedules.id,
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
        .where(eq(schedules.isDraft, false)) // 只缓存已发布的排期
        .orderBy(asc(schedules.playDate))

      // 获取所有用户的姓名列表，用于检测同名用户
      const allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          grade: users.grade,
          class: users.class
        })
        .from(users)

      // 创建姓名到用户数组的映射
      const nameToUsers = new Map()
      allUsers.forEach((user) => {
        if (user.name) {
          if (!nameToUsers.has(user.name)) {
            nameToUsers.set(user.name, [])
          }
          nameToUsers.get(user.name).push(user)
        }
      })

      // 获取每首歌的投票数
      const songIds = schedulesData.map((s) => s.songId)
      const voteCounts = await Promise.all(
        songIds.map(async (songId) => {
          const voteCountResult = await db
            .select({ count: count() })
            .from(votes)
            .where(eq(votes.songId, songId))
          return { songId, count: voteCountResult[0].count }
        })
      )

      const voteCountMap = new Map(voteCounts.map((v) => [v.songId, v.count]))

      // 转换数据格式
      const formattedSchedules = schedulesData.map((schedule) => {
        const dateOnly = schedule.playDate

        // 处理投稿人姓名，如果是同名用户则添加后缀
        let requesterName = schedule.requesterName || '未知用户'

        const sameNameUsers = nameToUsers.get(requesterName)
        if (sameNameUsers && sameNameUsers.length > 1) {
          if (schedule.requesterGrade) {
            const sameGradeUsers = sameNameUsers.filter(
              (u: {
                id: number
                name: string | null
                grade: string | null
                class: string | null
              }) => u.grade === schedule.requesterGrade
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
          playDate: dateOnly.toISOString().split('T')[0],
          sequence: schedule.sequence || 1,
          played: schedule.played || false,
          playTimeId: schedule.playTimeId,
          isDraft: schedule.isDraft,
          publishedAt: schedule.publishedAt,
          playTime: schedule.playTimeName
            ? {
                id: schedule.playTimeId,
                name: schedule.playTimeName,
                startTime: schedule.playTimeStartTime,
                endTime: schedule.playTimeEndTime,
                enabled: schedule.playTimeEnabled
              }
            : null,
          song: {
            id: schedule.songId,
            title: schedule.songTitle,
            artist: schedule.songArtist,
            requester: requesterName,
            voteCount: voteCountMap.get(schedule.songId) || 0,
            played: schedule.songPlayed || false,
            cover: schedule.songCover || null,
            musicPlatform: schedule.songMusicPlatform || null,
            musicId: schedule.songMusicId || null,
            semester: schedule.songSemester || null
          }
        }
      })

      const completeSchedules = formattedSchedules

      // 重新缓存完整的排期列表
      if (completeSchedules && completeSchedules.length > 0) {
        await cacheService.setSchedulesList(completeSchedules)
        console.log(`[Cache] 已发布排期列表已重新缓存，数量: ${completeSchedules.length}`)
      } else {
        console.log('[Cache] 没有已发布排期数据需要缓存')
      }
    } catch (cacheError) {
      console.warn('[Cache] 重新缓存完整排期列表失败，但不影响排期发布:', cacheError)
    }

    return {
      ...draft,
      isDraft: false,
      publishedAt: publishedAt,
      message: '排期发布成功，通知已发送'
    }
  } catch (error: any) {
    console.error('发布排期失败:', error)
    throw createError({
      statusCode: 500,
      message: error.message || '发布排期失败'
    })
  }
})
