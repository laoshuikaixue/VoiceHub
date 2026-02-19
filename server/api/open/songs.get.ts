import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { playTimes, schedules, songs, users, votes } from '~/drizzle/schema'
import { and, asc, count, desc, eq, inArray, like, or } from 'drizzle-orm'
import { openApiCache } from '~~/server/utils/open-api-cache'
import { CACHE_CONSTANTS } from '~~/server/config/constants'
import { cache } from '~~/server/utils/cache-helpers'
import crypto from 'crypto'
import { formatDateTime } from '~/utils/timeUtils'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const apiKey = event.context.apiKey

    // API认证中间件已经验证了权限，这里只需要确保有API Key信息
    if (!apiKey) {
      throw createError({
        statusCode: 401,
        message: 'API认证失败'
      })
    }

    const search = (query.search as string) || ''
    const semester = (query.semester as string) || ''
    const grade = (query.grade as string) || ''
    const played = query.played as string // 'true', 'false', 或空字符串
    const scheduled = query.scheduled as string // 'true', 'false', 或空字符串
    const page = parseInt(query.page as string) || 1
    const limit = Math.min(parseInt(query.limit as string) || 20, 100) // 最大100条
    const sortBy = (query.sortBy as string) || 'createdAt'
    const sortOrder = (query.sortOrder as string) || 'desc'

    // 优先从普通API缓存获取数据
    // 构建与普通API相同的缓存键
    const queryParams = {
      search: search || '',
      semester: semester || '',
      sortBy,
      sortOrder
    }
    const queryHash = crypto.createHash('md5').update(JSON.stringify(queryParams)).digest('hex')
    const normalApiCacheKey = `songs:list:${queryHash}`

    // 尝试从普通API缓存获取基础数据
    const cachedSongsData = await cache.get<any>(normalApiCacheKey)
    if (cachedSongsData !== null) {
      console.log(`[OpenAPI Cache] 使用普通API歌曲缓存数据: ${normalApiCacheKey}`)

      // 转换为开放API格式
      const songs = cachedSongsData.data?.songs || []
      const total = cachedSongsData.data?.total || 0

      // 应用分页
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedSongs = songs.slice(startIndex, endIndex)

      const result = {
        success: true,
        data: {
          songs: paginatedSongs.map((song: any) => ({
            id: song.id,
            title: song.title,
            artist: song.artist,
            semester: song.semester,
            cover: song.cover,
            musicPlatform: song.musicPlatform,
            musicId: song.musicId,
            playUrl: song.playUrl,
            voteCount: song.voteCount || 0,
            scheduled: song.scheduled || false,
            played: song.played || false,
            playedAt: song.playedAt,
            createdAt: song.createdAt,
            requester: song.requester
              ? {
                  name: song.requester.name,
                  grade: song.requester.grade,
                  class: song.requester.class
                }
              : null
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          },
          filters: {
            search: search || null,
            semester: semester || null
          }
        }
      }

      return result
    }

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

    if (played === 'true') {
      conditions.push(eq(songs.played, true))
    } else if (played === 'false') {
      conditions.push(eq(songs.played, false))
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined

    // 计算偏移量
    const offset = (page - 1) * limit

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
              : sortBy === 'playedAt'
                ? sortOrder === 'desc'
                  ? desc(songs.playedAt)
                  : asc(songs.playedAt)
                : desc(songs.createdAt)
      )
      .limit(limit)
      .offset(offset)

    // 获取每首歌的投票数
    const songIds = songsData.map((song) => song.id)
    const voteCountsQuery =
      songIds.length > 0
        ? await db
            .select({
              songId: votes.songId,
              count: count(votes.id)
            })
            .from(votes)
            .where(inArray(votes.songId, songIds))
            .groupBy(votes.songId)
        : []

    const voteCounts = new Map(voteCountsQuery.map((v) => [v.songId, v.count]))

    // 获取每首歌的排期状态
    // 只查询已发布的排期，草稿不算作已排期
    const schedulesQuery =
      songIds.length > 0
        ? await db
            .select({
              songId: schedules.songId
            })
            .from(schedules)
            .where(and(inArray(schedules.songId, songIds), eq(schedules.isDraft, false)))
        : []

    const scheduledSongs = new Set(schedulesQuery.map((s) => s.songId))

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

    // 转换数据格式
    let formattedSongs = songsData.map((song) => {
      // 处理投稿人姓名，如果是同名用户则添加后缀
      let requesterName = song.requester?.name || '未知用户'

      // 检查是否有同名用户
      const sameNameUsers = nameToUsers.get(requesterName)
      if (sameNameUsers && sameNameUsers.length > 1) {
        const requesterWithGradeClass = song.requester

        // 如果有年级信息，则添加年级后缀
        if (requesterWithGradeClass?.grade) {
          // 检查同一个年级是否有同名
          const sameGradeUsers = sameNameUsers.filter(
            (u: { grade?: string; class?: string }) => u.grade === requesterWithGradeClass.grade
          )

          if (sameGradeUsers.length > 1 && requesterWithGradeClass.class) {
            // 同一个年级有同名，添加班级后缀
            requesterName = `${requesterName}（${requesterWithGradeClass.grade} ${requesterWithGradeClass.class}）`
          } else {
            // 只添加年级后缀
            requesterName = `${requesterName}（${requesterWithGradeClass.grade}）`
          }
        }
      }

      // 创建歌曲对象
      const songObject: any = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        requester: requesterName,
        requesterId: song.requester?.id,
        voteCount: voteCounts.get(song.id) || 0,
        played: song.played,
        playedAt: song.playedAt,
        playedAtFormatted: song.playedAt ? formatDateTime(song.playedAt) : null,
        semester: song.semester,
        createdAt: song.createdAt,
        updatedAt: song.updatedAt,
        requestedAt: formatDateTime(song.createdAt),
        scheduled: scheduledSongs.has(song.id),
        cover: song.cover || null,
        musicPlatform: song.musicPlatform || null,
        musicId: song.musicId || null,
        playUrl: song.playUrl || null,
        preferredPlayTimeId: song.preferredPlayTimeId
      }

      // 添加期望播放时段相关字段
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

    // 如果需要按排期状态筛选
    if (scheduled === 'true') {
      formattedSongs = formattedSongs.filter((song) => song.scheduled)
    } else if (scheduled === 'false') {
      formattedSongs = formattedSongs.filter((song) => !song.scheduled)
    }

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

    const result = {
      success: true,
      data: {
        songs: formattedSongs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    }

    // 将查询结果缓存到普通API缓存中，供普通API和开放API共享
    const normalApiResult = {
      success: true,
      data: {
        songs: songsWithDetails,
        total,
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    }

    // 使用与普通API相同的缓存键格式（变量已在前面声明）

    await cache.set(normalApiCacheKey, normalApiResult, 180) // 3分钟缓存
    console.log(
      `[OpenAPI Cache] 歌曲数据已缓存到普通API缓存: ${normalApiCacheKey}，数量: ${songsWithDetails.length}`
    )

    // 可选：也缓存到开放API专用缓存（保留原有逻辑，但优先级较低）
    const openApiCacheKey = openApiCache.generateKey('songs', {
      search,
      semester,
      page,
      limit,
      sortBy,
      sortOrder
    })
    await openApiCache.set(openApiCacheKey, result, CACHE_CONSTANTS.DEFAULT_TTL)

    return result
  } catch (error: any) {
    console.error('[Open API] 获取歌曲列表失败:', error)

    if (error.statusCode) {
      throw error
    } else {
      throw createError({
        statusCode: 500,
        message: '获取歌曲列表失败'
      })
    }
  }
})
