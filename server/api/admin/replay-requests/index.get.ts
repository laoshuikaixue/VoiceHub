import { db, songs, songReplayRequests, users, semesters } from '~/drizzle/db'
import { desc, eq, sql, and, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 1. 检查权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
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
  // 获取歌曲信息及重播申请数量，同时关联用户信息
  const requestsQuery = db
    .select({
      song: songs,
      requester: {
        id: users.id,
        name: users.name,
        grade: users.grade,
        class: users.class
      },
      requestCount: sql<number>`count(${songReplayRequests.id})`
        .mapWith(Number)
        .as('request_count'),
      lastRequestedAt: sql<string>`max(${songReplayRequests.createdAt})`.as('last_requested_at')
    })
    .from(songs)
    .innerJoin(songReplayRequests, eq(songs.id, songReplayRequests.songId))
    .leftJoin(users, eq(songs.requesterId, users.id))
    .groupBy(songs.id, users.id)
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
      songId: songReplayRequests.songId,
      user: {
        name: users.name,
        grade: users.grade,
        class: users.class
      },
      createdAt: songReplayRequests.createdAt,
      status: songReplayRequests.status
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
      name: formatDisplayName(d.user),
      grade: d.user.grade,
      class: d.user.class,
      createdAt: d.createdAt,
      status: d.status
    })
  })

  return requests.map((item) => ({
    ...item.song,
    requester: formatDisplayName(item.requester),
    requesterGrade: item.requester?.grade,
    requesterClass: item.requester?.class,
    voteCount: item.requestCount,
    requestCount: item.requestCount,
    lastRequestedAt: item.lastRequestedAt,
    requestDetails: detailsMap.get(item.song.id) || []
  }))
})
