import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import {
  playTimes,
  schedules,
  songCollaborators,
  songReplayRequests,
  songs,
  users,
  votes
} from '~/drizzle/schema'
import { and, asc, count, desc, eq, inArray, like, or } from 'drizzle-orm'
import { cacheService } from '~~/server/services/cacheService'
import { formatDateTime } from '~/utils/timeUtils'
import crypto from 'crypto'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)

    const search = (query.search as string) || ''
    const semester = (query.semester as string) || ''
    const grade = (query.grade as string) || ''
    const scope = (query.scope as string) || '' // 'mine' 或为空
    const sortBy = (query.sortBy as string) || 'createdAt'
    const sortOrder = (query.sortOrder as string) || 'desc'
    const bypassCache = query.bypass_cache === 'true'

    // 获取用户身份
    const user = event.context.user || null
    console.log('[Songs API] 用户认证状态:', {
      hasUser: !!user,
      userId: user?.id,
      userName: user?.name,
      userRole: user?.role
    })

    // 构建缓存键（基于查询参数，但不包含用户ID以提高缓存命中率）
    const queryParams = {
      search: search || '',
      semester: semester || '',
      grade: grade || '',
      scope: scope || '',
      userId: scope === 'mine' ? user?.id : undefined, // 如果 scope 为 mine，则将 userId 包含在缓存键中
      sortBy,
      sortOrder
    }
    const queryHash = crypto.createHash('md5').update(JSON.stringify(queryParams)).digest('hex')
    const cacheKey = `songs:list:${queryHash}`

    // 如果不绕过缓存，尝试从缓存获取基础数据（不包含用户特定的投票状态和动态状态）
    let cachedData = null
    if (!bypassCache) {
      cachedData = await cacheService.getCache<any>(cacheKey)
    }
    if (cachedData !== null) {
      console.log(
        `[Cache] 歌曲列表缓存命中: ${cacheKey}, 歌曲数: ${cachedData.data?.songs?.length || 0}`
      )

      // 重新获取动态状态数据（scheduled状态可能已变化）
      // 只查询已发布的排期，草稿不算作已排期
      const schedulesQuery = await db
        .select({
          songId: schedules.songId
        })
        .from(schedules)
        .where(eq(schedules.isDraft, false))

      const scheduledSongs = new Set(schedulesQuery.map((s) => s.songId))

      // 更新缓存数据中的scheduled状态
      cachedData.data.songs.forEach((song: any) => {
        song.scheduled = scheduledSongs.has(song.id)
      })

      // 如果用户已登录，需要添加用户特定的投票状态
      if (user) {
        // 获取用户的投票状态
        const userVotesQuery = await db
          .select({
            songId: votes.songId
          })
          .from(votes)
          .where(eq(votes.userId, user.id))

        const userVotedSongs = new Set(userVotesQuery.map((v) => v.songId))

        // 获取用户的重播申请状态
        const userReplayRequestsQuery = await db
          .select({
            songId: songReplayRequests.songId,
            status: songReplayRequests.status,
            updatedAt: songReplayRequests.updatedAt
          })
          .from(songReplayRequests)
          .where(eq(songReplayRequests.userId, user.id))

        const userReplayRequestsMap = new Map(userReplayRequestsQuery.map((r) => [r.songId, r]))

        // 为每首歌添加用户特定的状态
        cachedData.data.songs.forEach((song: any) => {
          song.voted = userVotedSongs.has(song.id)
          song.replayRequested = userReplayRequestsMap.has(song.id)

          // 注入重播申请详细状态
          if (userReplayRequestsMap.has(song.id)) {
            const replayRequest = userReplayRequestsMap.get(song.id)!
            song.replayRequestStatus = replayRequest.status

            if (replayRequest.status === 'REJECTED' && replayRequest.updatedAt) {
              const COOLDOWN_HOURS = 24
              const cooldownTime = COOLDOWN_HOURS * 60 * 60 * 1000
              const timeSinceUpdate = Date.now() - new Date(replayRequest.updatedAt).getTime()
              const remainingTime = cooldownTime - timeSinceUpdate
              song.replayRequestCooldownRemaining =
                remainingTime > 0 ? Math.ceil(remainingTime / (60 * 60 * 1000)) : 0
            }
          }
        })
      }

      return cachedData
    }

    console.log(
      `[Cache] 歌曲列表${bypassCache ? '绕过缓存' : '缓存未命中'}，查询数据库: ${cacheKey}`
    )

    // 构建查询条件
    const conditions = []

    if (search) {
      conditions.push(or(like(songs.title, `%${search}%`), like(songs.artist, `%${search}%`)))
    }

    if (semester) {
      conditions.push(eq(songs.semester, semester))
    }

    if (grade) {
      conditions.push(eq(users.grade, grade))
    }

    if (scope === 'mine' && user) {
      conditions.push(eq(songs.requesterId, user.id))
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined

    // 查询歌曲总数
    const totalResult = await db
      .select({ count: count() })
      .from(songs)
      .leftJoin(users, eq(songs.requesterId, users.id))
      .where(whereCondition)
    const total = totalResult[0].count

    // 获取歌曲数据
    const songsData = await db
      .select({
        id: songs.id,
        title: songs.title,
        artist: songs.artist,
        played: songs.played,
        playedAt: songs.playedAt,
        semester: songs.semester,
        createdAt: songs.createdAt,
        updatedAt: songs.updatedAt,
        cover: songs.cover,
        musicPlatform: songs.musicPlatform,
        musicId: songs.musicId,
        playUrl: songs.playUrl,
        preferredPlayTimeId: songs.preferredPlayTimeId,
        requester: {
          id: users.id,
          name: users.name,
          grade: users.grade,
          class: users.class
        }
      })
      .from(songs)
      .leftJoin(users, eq(songs.requesterId, users.id))
      .where(whereCondition)
      .orderBy(
        sortBy === 'createdAt'
          ? sortOrder === 'desc'
            ? desc(songs.createdAt)
            : asc(songs.createdAt)
          : sortBy === 'title'
            ? sortOrder === 'desc'
              ? desc(songs.title)
              : asc(songs.title)
            : sortBy === 'artist'
              ? sortOrder === 'desc'
                ? desc(songs.artist)
                : asc(songs.artist)
              : desc(songs.createdAt)
      )

    // 获取每首歌的投票数
    const voteCountsQuery = await db
      .select({
        songId: votes.songId,
        count: count(votes.id)
      })
      .from(votes)
      .groupBy(votes.songId)

    const voteCounts = new Map(voteCountsQuery.map((v) => [v.songId, v.count]))

    // 获取每首歌的投票详情（用于检查用户是否已投票）
    const songVotesQuery = await db
      .select({
        songId: votes.songId,
        userId: votes.userId
      })
      .from(votes)

    const songVotes = new Map()
    songVotesQuery.forEach((vote) => {
      if (!songVotes.has(vote.songId)) {
        songVotes.set(vote.songId, [])
      }
      songVotes.get(vote.songId).push(vote.userId)
    })

    // 获取每首歌的排期状态和日期
    // 只查询已发布的排期，草稿不算作已排期
    const schedulesQuery = await db
      .select({
        songId: schedules.songId,
        playDate: schedules.playDate,
        played: schedules.played
      })
      .from(schedules)
      .where(eq(schedules.isDraft, false))

    const scheduledSongs = new Set(schedulesQuery.map((s) => s.songId))
    const scheduleInfo = new Map(
      schedulesQuery.map((s) => [
        s.songId,
        {
          playDate: s.playDate,
          played: s.played
        }
      ])
    )

    // 获取每首歌的重播申请状态（全局，不分用户，仅统计 PENDING）
    const songIds = songsData.map((s) => s.id)
    let replayRequestCounts = new Map()
    const replayRequestersMap = new Map()

    if (songIds.length > 0) {
      const allReplayRequestsQuery = await db
        .select({
          songId: songReplayRequests.songId,
          count: count(songReplayRequests.id)
        })
        .from(songReplayRequests)
        .where(
          and(inArray(songReplayRequests.songId, songIds), eq(songReplayRequests.status, 'PENDING'))
        )
        .groupBy(songReplayRequests.songId)

      replayRequestCounts = new Map(allReplayRequestsQuery.map((r) => [r.songId, r.count]))

      // 获取重播申请人信息
      const replayRequestersData = await db
        .select({
          songId: songReplayRequests.songId,
          user: {
            id: users.id,
            name: users.name
          },
          createdAt: songReplayRequests.createdAt
        })
        .from(songReplayRequests)
        .innerJoin(users, eq(songReplayRequests.userId, users.id))
        .where(
          and(inArray(songReplayRequests.songId, songIds), eq(songReplayRequests.status, 'PENDING'))
        )
        .orderBy(desc(songReplayRequests.createdAt))

      replayRequestersData.forEach((r) => {
        if (!replayRequestersMap.has(r.songId)) {
          replayRequestersMap.set(r.songId, [])
        }
        // 只保留前3个
        if (replayRequestersMap.get(r.songId).length < 3) {
          replayRequestersMap.get(r.songId).push({
            id: r.user.id,
            name: r.user.name || '未知用户',
            createdAt: r.createdAt
          })
        }
      })
    }

    // 获取期望播放时段信息
    const playTimesQuery = await db.select().from(playTimes)

    const playTimesMap = new Map(playTimesQuery.map((pt) => [pt.id, pt]))

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
    allUsers.forEach((u) => {
      if (u.name) {
        if (!nameToUsers.has(u.name)) {
          nameToUsers.set(u.name, [])
        }
        nameToUsers.get(u.name).push(u)
      }
    })

    // 获取当前用户的重播申请
    const userReplayRequestedSongs = new Set()
    const userReplayRequestsMap = new Map() // 存储详细的重播申请信息
    if (user) {
      const userReplayRequestsQuery = await db
        .select({
          songId: songReplayRequests.songId,
          status: songReplayRequests.status,
          updatedAt: songReplayRequests.updatedAt
        })
        .from(songReplayRequests)
        .where(eq(songReplayRequests.userId, user.id))

      userReplayRequestsQuery.forEach((r) => {
        userReplayRequestedSongs.add(r.songId)
        userReplayRequestsMap.set(r.songId, {
          status: r.status,
          updatedAt: r.updatedAt
        })
      })
    }

    // 获取联合投稿人信息
    // const songIds = songsData.map(s => s.id) // Already defined above
    const collaboratorsMap = new Map()

    if (songIds.length > 0) {
      const collaboratorsData = await db
        .select({
          songId: songCollaborators.songId,
          status: songCollaborators.status,
          user: {
            id: users.id,
            name: users.name,
            grade: users.grade,
            class: users.class
          }
        })
        .from(songCollaborators)
        .leftJoin(users, eq(songCollaborators.userId, users.id))
        .where(
          and(
            inArray(songCollaborators.songId, songIds),
            eq(songCollaborators.status, 'ACCEPTED') // 只展示已接受的
          )
        )

      collaboratorsData.forEach((c) => {
        if (!collaboratorsMap.has(c.songId)) {
          collaboratorsMap.set(c.songId, [])
        }
        if (c.user) {
          collaboratorsMap.get(c.songId).push(c.user)
        }
      })
    }

    // 辅助函数：格式化显示名称
    const formatDisplayName = (userObj: any) => {
      if (!userObj || !userObj.name) return '未知用户'
      let displayName = userObj.name

      const sameNameUsers = nameToUsers.get(displayName)
      if (sameNameUsers && sameNameUsers.length > 1) {
        if (userObj.grade) {
          const sameGradeUsers = sameNameUsers.filter((u: any) => u.grade === userObj.grade)
          if (sameGradeUsers.length > 1 && userObj.class) {
            displayName = `${displayName}（${userObj.grade} ${userObj.class}）`
          } else {
            displayName = `${displayName}（${userObj.grade}）`
          }
        }
      }
      return displayName
    }

    // 转换数据格式
    const formattedSongs = songsData.map((song) => {
      // 处理投稿人姓名
      const requesterName = formatDisplayName(song.requester)

      // 处理联合投稿人
      const collaborators = collaboratorsMap.get(song.id) || []
      const formattedCollaborators = collaborators.map((c: any) => ({
        id: c.id,
        name: c.name,
        displayName: formatDisplayName(c),
        grade: c.grade,
        class: c.class
      }))

      // 创建基本歌曲对象
      const songObject: any = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        requester: requesterName,
        requesterId: song.requester?.id,
        collaborators: formattedCollaborators, // 添加联合投稿人列表
        voteCount: voteCounts.get(song.id) || 0,
        played: song.played,
        playedAt: song.playedAt,
        semester: song.semester,
        createdAt: song.createdAt,
        updatedAt: song.updatedAt,
        requestedAt: formatDateTime(song.createdAt), // 添加请求时间的格式化字符串
        scheduled: scheduledSongs.has(song.id), // 添加是否已排期的标志
        cover: song.cover || null, // 添加封面字段
        musicPlatform: song.musicPlatform || null, // 添加音乐平台字段
        musicId: song.musicId || null, // 添加音乐ID字段
        playUrl: song.playUrl || null, // 添加播放地址字段
        requesterGrade: song.requester?.grade || null, // 添加投稿人年级
        requesterClass: song.requester?.class || null, // 添加投稿人班级
        replayRequested: userReplayRequestedSongs.has(song.id), // 添加是否已被申请重播的标志
        replayRequestCount: replayRequestCounts.get(song.id) || 0,
        isReplay: (replayRequestCounts.get(song.id) || 0) > 0,
        replayRequesters: replayRequestersMap.get(song.id) || []
      }

      // 添加用户的重播申请详细状态
      if (user && userReplayRequestsMap.has(song.id)) {
        const replayRequest = userReplayRequestsMap.get(song.id)
        songObject.replayRequestStatus = replayRequest.status
        songObject.replayRequestUpdatedAt = replayRequest.updatedAt

        // 如果状态是 REJECTED，计算冷却期剩余时间
        if (replayRequest.status === 'REJECTED') {
          const COOLDOWN_HOURS = 24
          const cooldownTime = COOLDOWN_HOURS * 60 * 60 * 1000
          const timeSinceUpdate = Date.now() - new Date(replayRequest.updatedAt).getTime()
          const remainingTime = cooldownTime - timeSinceUpdate

          if (remainingTime > 0) {
            songObject.replayRequestCooldownRemaining = Math.ceil(remainingTime / (60 * 60 * 1000)) // 剩余小时数
          } else {
            songObject.replayRequestCooldownRemaining = 0
          }
        }
      }

      // 添加排期信息
      const scheduleData = scheduleInfo.get(song.id)
      if (scheduleData) {
        songObject.scheduleDate = formatDateTime(scheduleData.playDate) // 排期日期
        songObject.schedulePlayed = scheduleData.played // 排期中的播放状态
      }

      // 如果用户已登录，添加投票状态
      if (user) {
        const userVotes = songVotes.get(song.id) || []
        songObject.voted = userVotes.includes(user.id)
      }

      // 添加期望播放时段相关字段
      songObject.preferredPlayTimeId = song.preferredPlayTimeId

      // 如果有期望播放时段，添加相关信息
      if (song.preferredPlayTimeId) {
        const preferredPlayTime = playTimesMap.get(song.preferredPlayTimeId)
        if (preferredPlayTime) {
          songObject.preferredPlayTime = {
            id: preferredPlayTime.id,
            name: preferredPlayTime.name,
            startTime: preferredPlayTime.startTime,
            endTime: preferredPlayTime.endTime,
            enabled: preferredPlayTime.enabled
          }
        }
      }

      return songObject
    })

    // 如果按投票数排序，需要重新排序
    if (sortBy === 'votes') {
      formattedSongs.sort((a, b) => {
        const diff = sortOrder === 'desc' ? b.voteCount - a.voteCount : a.voteCount - b.voteCount
        if (diff === 0) {
          // 投票数相同时，按提交时间排序（较早提交的优先）
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        }
        return diff
      })
    }

    // 构建返回结果（不包含用户特定的投票状态，以便缓存）
    const baseResult = {
      success: true,
      data: {
        songs: formattedSongs.map((song) => {
          const {
            voted,
            replayRequested,
            replayRequestStatus,
            replayRequestUpdatedAt,
            replayRequestCooldownRemaining,
            ...baseSong
          } = song
          return baseSong
        }),
        total
      }
    }

    // 如果不绕过缓存，缓存基础数据（3分钟，与开放API保持一致）
    if (!bypassCache) {
      await cacheService.setCache(cacheKey, baseResult, 180) // 180秒 = 3分钟
      console.log(`[Cache] 歌曲列表设置缓存: ${cacheKey}, 歌曲数: ${baseResult.data.songs.length}`)
    }

    // 如果用户已登录，添加投票状态到返回结果
    const result = {
      success: true,
      data: {
        songs: formattedSongs, // 包含用户投票状态的完整数据
        total
      }
    }

    console.log(
      `[Songs API] 成功返回 ${result.data.songs.length} 首歌曲，用户类型: ${user ? '登录用户' : '未登录用户'}`
    )

    return result
  } catch (error: any) {
    console.error('[Songs API] 获取歌曲列表失败:', error)

    // 检查是否是数据库连接错误
    const isDbError =
      error.message?.includes('ECONNRESET') ||
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
