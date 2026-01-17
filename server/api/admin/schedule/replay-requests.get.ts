import {
    db,
    songs,
    songReplayRequests,
    users
} from '~/drizzle/db'
import { desc, eq, sql, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    // 1. 检查权限
    const user = event.context.user
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        throw createError({ statusCode: 403, message: '权限不足' })
    }

    // 2. 查询
    // 获取歌曲信息及重播申请数量，同时关联用户信息
    const requests = await db
        .select({
            song: songs,
            requester: {
                id: users.id,
                name: users.name,
                grade: users.grade,
                class: users.class
            },
            requestCount: sql<number>`count(${songReplayRequests.id})`.mapWith(Number).as('request_count'),
            lastRequestedAt: sql<string>`max(${songReplayRequests.createdAt})`.as('last_requested_at')
        })
        .from(songs)
        .innerJoin(songReplayRequests, eq(songs.id, songReplayRequests.songId))
        .leftJoin(users, eq(songs.requesterId, users.id))
        .where(eq(songReplayRequests.status, 'PENDING'))
        .groupBy(songs.id, users.id)
        .orderBy(desc(sql`request_count`))

    // 获取所有用户姓名，用于处理同名情况（复用 index.get.ts 的逻辑）
    const allUsers = await db.select({
        name: users.name,
        grade: users.grade
    }).from(users)

    const nameToUsers = new Map()
    allUsers.forEach(u => {
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
    const requestDetails = await db.select({
        songId: songReplayRequests.songId,
        user: {
            name: users.name,
            grade: users.grade,
            class: users.class
        },
        createdAt: songReplayRequests.createdAt
    })
    .from(songReplayRequests)
    .innerJoin(users, eq(songReplayRequests.userId, users.id))
    .where(eq(songReplayRequests.status, 'PENDING'))
    .orderBy(desc(songReplayRequests.createdAt))

    const detailsMap = new Map()
    requestDetails.forEach(d => {
        if (!detailsMap.has(d.songId)) detailsMap.set(d.songId, [])
        detailsMap.get(d.songId).push({
            name: formatDisplayName(d.user),
            createdAt: d.createdAt
        })
    })

    return requests.map(item => ({
        ...item.song,
        requester: formatDisplayName(item.requester),
        requesterGrade: item.requester?.grade,
        requesterClass: item.requester?.class,
        voteCount: item.requestCount, // 将申请人数映射为 voteCount，方便前端统一显示
        requestCount: item.requestCount,
        lastRequestedAt: item.lastRequestedAt,
        requestDetails: detailsMap.get(item.song.id) || []
    }))
})
