import { db } from '~/drizzle/db'
import { playTimes, schedules, songs, users, votes, songReplayRequests } from '~/drizzle/schema'
import { and, asc, count, desc, eq, gte, lte, ne } from 'drizzle-orm'
import { createSongSelectedNotification } from '../../services/notificationService'
import { cacheService } from '~~/server/services/cacheService'

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
      message: '只有歌曲管理员及以上权限才能创建排期'
    })
  }

  const body = await readBody(event)

  if (!body.songId || !body.playDate) {
    throw createError({
      statusCode: 400,
      message: '歌曲ID和播放日期不能为空'
    })
  }

  // 检查是否为草稿模式（默认直接发布）
  const isDraft = body.isDraft === true

  try {
    // 检查歌曲是否存在
    const songResult = await db.select().from(songs).where(eq(songs.id, body.songId)).limit(1)

    const song = songResult[0]

    if (!song) {
      throw createError({
        statusCode: 404,
        message: '歌曲不存在'
      })
    }

    await db.transaction(async (tx) => {
      // 获取序号，如果未提供则查找当天最大序号+1
      let sequence = body.sequence || 1

      if (!body.sequence) {
        // 解析输入的日期字符串
        const inputDateStr =
          typeof body.playDate === 'string' ? body.playDate : body.playDate.toISOString()

        // 创建当天的开始和结束时间
        const startOfDay = new Date(inputDateStr + 'T00:00:00.000Z')
        const endOfDay = new Date(inputDateStr + 'T23:59:59.999Z')

        console.log('查询当天排期范围:', {
          输入日期: body.playDate,
          开始时间: startOfDay.toISOString(),
          结束时间: endOfDay.toISOString()
        })

        const sameDaySchedules = await tx
          .select()
          .from(schedules)
          .where(and(gte(schedules.playDate, startOfDay), lte(schedules.playDate, endOfDay)))
          .orderBy(desc(schedules.sequence))
          .limit(1)

        if (sameDaySchedules.length > 0) {
          sequence = (sameDaySchedules[0].sequence || 0) + 1
        }
      }

      // 解析输入的日期字符串，确保日期正确
      const inputDateStr =
        typeof body.playDate === 'string' ? body.playDate : body.playDate.toISOString()

      // 直接使用输入的日期字符串，添加时间部分以避免时区问题
      const playDate = new Date(inputDateStr + 'T00:00:00.000Z')

      // 创建排期
      const scheduleResult = await tx
        .insert(schedules)
        .values({
          songId: body.songId,
          playDate: playDate,
          sequence: sequence,
          playTimeId: body.playTimeId || null,
          // 草稿支持：根据参数决定是否为草稿
          isDraft: isDraft,
          publishedAt: isDraft ? null : new Date()
        })
        .returning()

      const schedule = {
        ...scheduleResult[0],
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          requesterId: song.requesterId
        }
      }

      // 只有在非草稿模式下才创建通知和更新重播状态
      if (!isDraft) {
        // 检查该歌曲是否已经有其他已发布的排期
        const existingPublished = await tx
          .select({ id: schedules.id })
          .from(schedules)
          .where(
            and(
              eq(schedules.songId, schedule.song.id),
              eq(schedules.isDraft, false),
              ne(schedules.id, scheduleResult[0].id)
            )
          )
          .limit(1)

        // 如果之前没有正式发布过，才发送通知和更新重播状态
        if (existingPublished.length === 0) {
          await createSongSelectedNotification(
            schedule.song.requesterId,
            schedule.song.id,
            {
              title: schedule.song.title,
              artist: schedule.song.artist,
              playDate: schedule.playDate
            }
          )

          // 标记该歌曲的所有待处理重播申请为已完成
          await tx
            .update(songReplayRequests)
            .set({ status: 'FULFILLED', updatedAt: scheduleResult[0].publishedAt || new Date() })
            .where(
              and(
                eq(songReplayRequests.songId, schedule.song.id),
                eq(songReplayRequests.status, 'PENDING')
              )
            )
        } else {
          console.log(`歌曲 ${schedule.song.id} 已有其他正式排期，不再重复发送通知或更新重播状态`)
        }
      }
    })

    // 清除相关缓存
    try {
      await cacheService.clearSchedulesCache()
      await cacheService.clearSongsCache() // 清除歌曲列表缓存，确保scheduled状态更新
      console.log(`[Cache] 排期缓存和歌曲列表缓存已清除（${isDraft ? '保存草稿' : '创建排期'}）`)
    } catch (cacheError) {
      console.error('[Cache] 清除缓存失败:', cacheError)
    }

    // 重新缓存完整的排期列表
    try {
      // 获取所有已发布排期数据
      const schedulesData = await db
        .select({
          id: schedules.id,
          playDate: schedules.playDate,
          sequence: schedules.sequence,
          played: schedules.played,
          playTimeId: schedules.playTimeId,
          songId: schedules.songId,
          songTitle: songs.title,
          songArtist: songs.artist,
          songRequesterId: songs.requesterId,
          songPlayed: songs.played,
          songCover: songs.cover,
          songMusicPlatform: songs.musicPlatform,
          songMusicId: songs.musicId,
          songPlayUrl: songs.playUrl,
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
        .where(eq(schedules.isDraft, false))
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
            playUrl: schedule.songPlayUrl || null,
            semester: schedule.songSemester || null
          }
        }
      })

      const completeSchedules = formattedSchedules

      // 重新缓存完整的排期列表
      if (completeSchedules && completeSchedules.length > 0) {
        await cacheService.setSchedulesList(completeSchedules)
        console.log(`[Cache] 完整排期列表已重新缓存，数量: ${completeSchedules.length}`)
      } else {
        console.log('[Cache] 没有排期数据需要缓存')
      }
    } catch (cacheError) {
      console.warn('[Cache] 重新缓存完整排期列表失败，但不影响排期创建:', cacheError)
    }

    return {
      ...schedule,
      isDraft: isDraft,
      publishedAt: isDraft ? null : schedule.publishedAt,
      message: isDraft ? '排期草稿保存成功' : '排期创建成功，通知已发送'
    }
  } catch (error: any) {
    console.error('创建排期失败:', error)
    throw createError({
      statusCode: 500,
      message: error.message || '创建排期失败'
    })
  }
})
