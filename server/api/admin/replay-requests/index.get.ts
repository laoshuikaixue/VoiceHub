import { db, songs, songReplayRequests, users } from '~/drizzle/db'
import { desc, eq, sql, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 1. 检查权限
  const user = event.context.user
  if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  // 获取查询参数
  const query = getQuery(event)
  const status = (query.status as string) || 'PENDING' // PENDING, FULFILLED, REJECTED, ALL
  const semesterName = query.semester as string

  // 构建查询条件
  const conditions = []

  if (status !== 'ALL') {
    conditions.push(eq(songReplayRequests.status, status as any))
  }

  if (semesterName) {
    conditions.push(eq(songs.semester, semesterName))
  }

  // 2. 查询
  // 获取歌曲信息及重播申请数量，同时关联最新申请人信息
  const requestsQuery = db
    .select({
      song: {
        id: songs.id,
        createdAt: songs.createdAt,
        updatedAt: songs.updatedAt,
        title: songs.title,
        artist: songs.artist,
        requesterId: songs.requesterId,
        played: songs.played,
        playedAt: songs.playedAt,
        semester: songs.semester,
        preferredPlayTimeId: songs.preferredPlayTimeId,
        cover: songs.cover,
        playUrl: songs.playUrl,
        musicPlatform: songs.musicPlatform,
        musicId: songs.musicId,
        durationSeconds: songs.durationSeconds,
        submissionNote: songs.submissionNote,
        submissionNotePublic: songs.submissionNotePublic,
        hitRequestId: songs.hitRequestId
      },
      // insert-only 模型下同一用户可能有多条申请，按申请人去重计数
      requestCount: sql<number>`count(distinct ${songReplayRequests.userId})`
        .mapWith(Number)
        .as('request_count'),
      lastRequestedAt: sql<string>`max(${songReplayRequests.createdAt})`.as('last_requested_at')
    })
    .from(songs)
    .innerJoin(songReplayRequests, eq(songs.id, songReplayRequests.songId))
    .groupBy(songs.id)
    .orderBy(desc(sql`request_count`))

  if (conditions.length > 0) {
    requestsQuery.where(and(...conditions))
  }

  const requests = await requestsQuery

  // 获取所有用户姓名，用于处理同名情况
  const allUsers = await db
    .select({
      name: users.name,
      grade: users.grade
    })
    .from(users)

  const nameToUsers = new Map()
  allUsers.forEach((u) => {
    if (u.name) {
      if (!nameToUsers.has(u.name)) {
        nameToUsers.set(u.name, [])
      }
      nameToUsers.get(u.name).push(u)
    }
  })

  const formatDisplayName = (userObj: any) => {
    if (!userObj || !userObj.name) return '未知用户'
    let displayName = userObj.name

    const sameNameUsers = nameToUsers.get(displayName)
    if (sameNameUsers && sameNameUsers.length > 1) {
      if (userObj.grade) {
        displayName = `${displayName}（${userObj.grade}）`
      }
    }
    return displayName
  }

  // 获取详细的重播申请人信息
  const requestDetailsQuery = db
    .select({
      id: songReplayRequests.id,
      songId: songReplayRequests.songId,
      user: {
        id: users.id,
        name: users.name,
        grade: users.grade,
        class: users.class
      },
      createdAt: songReplayRequests.createdAt,
      status: songReplayRequests.status,
      preferredPlayTimeId: songReplayRequests.preferredPlayTimeId,
      submissionNote: songReplayRequests.submissionNote,
      submissionNotePublic: songReplayRequests.submissionNotePublic,
      submissionNotePublicStatus: songReplayRequests.submissionNotePublicStatus
    })
    .from(songReplayRequests)
    .innerJoin(users, eq(songReplayRequests.userId, users.id))
    .innerJoin(songs, eq(songReplayRequests.songId, songs.id))
    .orderBy(desc(songReplayRequests.createdAt))

  const subConditions = []
  if (status !== 'ALL') {
    subConditions.push(eq(songReplayRequests.status, status as any))
  }
  if (semesterName) {
    subConditions.push(eq(songs.semester, semesterName))
  }

  if (subConditions.length > 0) {
    requestDetailsQuery.where(and(...subConditions))
  }

  const requestDetails = await requestDetailsQuery

  const detailsMap = new Map()
  requestDetails.forEach((d) => {
    if (!detailsMap.has(d.songId)) detailsMap.set(d.songId, [])
    detailsMap.get(d.songId).push({
      id: d.id,
      userId: d.user.id,
      name: formatDisplayName(d.user),
      grade: d.user.grade,
      class: d.user.class,
      createdAt: d.createdAt,
      status: d.status,
      preferredPlayTimeId: d.preferredPlayTimeId,
      submissionNote: d.submissionNote,
      submissionNotePublic: d.submissionNotePublic
    })
  })

  return requests.map((item) => {
    const requestDetails = detailsMap.get(item.song.id) || []
    const latestRequest = requestDetails[0]

    return {
      ...item.song,
      requesterId: latestRequest?.userId || null,
      preferredPlayTimeId: latestRequest?.preferredPlayTimeId || null,
      submissionNote: latestRequest?.submissionNote || null,
      submissionNotePublic: latestRequest?.submissionNotePublic === true,
      submissionNotePublicStatus: latestRequest?.submissionNotePublicStatus || null,
      hasSubmissionNote: !!latestRequest?.submissionNote,
      requester: latestRequest?.name || '未知用户',
      requesterGrade: latestRequest?.grade || null,
      requesterClass: latestRequest?.class || null,
      replayRequestId: latestRequest?.id || null,
      replayRequestCount: item.requestCount,
      replayRequesters: requestDetails.map((request: any) => ({
        id: request.userId,
        name: request.name,
        displayName: request.name,
        grade: request.grade,
        class: request.class,
        status: request.status,
        createdAt: request.createdAt
      })),
      isReplay: true,
      voteCount: item.requestCount,
      requestCount: item.requestCount,
      lastRequestedAt: item.lastRequestedAt,
      requestDetails
    }
  })
})
