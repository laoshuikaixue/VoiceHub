import {db} from '~/drizzle/db'
import {schedules, songs, users, votes} from '~/drizzle/schema'
import {and, count, desc, eq, inArray} from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    try {
        // 使用认证中间件提供的用户信息
        const currentUser = event.context.user
        if (!currentUser) {
            throw createError({
                statusCode: 401,
                statusMessage: '未授权访问'
            })
        }

        // 检查是否为管理员、歌曲管理员或超级管理员
        const allowedRoles = ['ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN']
        if (!allowedRoles.includes(currentUser.role)) {
            throw createError({
                statusCode: 403,
                statusMessage: '权限不足'
            })
        }

        // 获取用户ID
        const userId = parseInt(getRouterParam(event, 'id') as string)
        if (!userId || isNaN(userId)) {
            throw createError({
                statusCode: 400,
                statusMessage: '无效的用户ID'
            })
        }

        // 验证用户是否存在
        const userResult = await db.select({
            id: users.id,
            name: users.name,
            username: users.username,
            grade: users.grade,
            class: users.class
        }).from(users).where(eq(users.id, userId)).limit(1)

        const user = userResult[0]

        if (!user) {
            throw createError({
                statusCode: 404,
                statusMessage: '用户不存在'
            })
        }

        // 获取用户投稿的歌曲
        const submittedSongs = await db.select({
            id: songs.id,
            title: songs.title,
            artist: songs.artist,
            createdAt: songs.createdAt,
            played: songs.played
        }).from(songs).where(eq(songs.requesterId, userId)).orderBy(desc(songs.createdAt))

        // 获取投稿歌曲的投票数
        const submittedSongIds = submittedSongs.map(song => song.id)
        let submittedVoteCountsMap = new Map()
        if (submittedSongIds.length > 0) {
            const submittedVoteCountsResult = await db.select({
                songId: votes.songId,
                voteCount: count(votes.id)
            }).from(votes)
                .where(inArray(votes.songId, submittedSongIds))
                .groupBy(votes.songId)

            submittedVoteCountsResult.forEach(item => {
                submittedVoteCountsMap.set(item.songId, item.voteCount)
            })
        }

        // 获取用户投票的歌曲
        const votedSongs = await db.select({
            id: votes.id,
            createdAt: votes.createdAt,
            songId: votes.songId,
            songTitle: songs.title,
            songArtist: songs.artist,
            songPlayed: songs.played,
            requesterName: users.name,
            requesterGrade: users.grade,
            requesterClass: users.class
        }).from(votes)
            .leftJoin(songs, eq(votes.songId, songs.id))
            .leftJoin(users, eq(songs.requesterId, users.id))
            .where(eq(votes.userId, userId))
            .orderBy(desc(votes.createdAt))

        // 获取投票歌曲的投票数
        const votedSongIds = votedSongs.map(vote => vote.songId).filter(id => id !== null)
        let votedVoteCountsMap = new Map()
        if (votedSongIds.length > 0) {
            const votedVoteCountsResult = await db.select({
                songId: votes.songId,
                voteCount: count(votes.id)
            }).from(votes)
                .where(inArray(votes.songId, votedSongIds))
                .groupBy(votes.songId)

            votedVoteCountsResult.forEach(item => {
                votedVoteCountsMap.set(item.songId, item.voteCount)
            })
        }

        // 获取投稿歌曲的排期状态
        // 只查询已发布的排期，草稿不算作已排期
        let submittedScheduleMap = new Map()
        if (submittedSongIds.length > 0) {
            const submittedScheduleResult = await db.select({
                songId: schedules.songId
            }).from(schedules)
                .where(and(
                    inArray(schedules.songId, submittedSongIds),
                    eq(schedules.isDraft, false)
                ))

            submittedScheduleResult.forEach(item => {
                submittedScheduleMap.set(item.songId, true)
            })
        }

        // 获取投票歌曲的排期状态
        // 只查询已发布的排期，草稿不算作已排期
        let votedScheduleMap = new Map()
        if (votedSongIds.length > 0) {
            const votedScheduleResult = await db.select({
                songId: schedules.songId
            }).from(schedules)
                .where(and(
                    inArray(schedules.songId, votedSongIds),
                    eq(schedules.isDraft, false)
                ))

            votedScheduleResult.forEach(item => {
                votedScheduleMap.set(item.songId, true)
            })
        }

        return {
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                grade: user.grade,
                class: user.class
            },
            submittedSongs: submittedSongs.map(song => ({
                id: song.id,
                title: song.title,
                artist: song.artist,
                createdAt: song.createdAt,
                played: song.played,
                scheduled: submittedScheduleMap.has(song.id),
                voteCount: submittedVoteCountsMap.get(song.id) || 0
            })),
            votedSongs: votedSongs.map(vote => ({
                id: vote.songId,
                title: vote.songTitle,
                artist: vote.songArtist,
                played: vote.songPlayed,
                scheduled: votedScheduleMap.has(vote.songId),
                voteCount: votedVoteCountsMap.get(vote.songId) || 0,
                votedAt: vote.createdAt,
                requester: {
                    name: vote.requesterName,
                    grade: vote.requesterGrade,
                    class: vote.requesterClass
                }
            }))
        }
    } catch (error) {
        console.error('获取用户歌曲信息失败:', error)

        if (error.statusCode) {
            throw error
        }

        throw createError({
            statusCode: 500,
            statusMessage: '服务器内部错误'
        })
    }
})