import {db, requestTimes} from '~/drizzle/db'
import {cacheService} from '~/server/services/cacheService'
import {schedules, songs, systemSettings, votes} from '~/drizzle/schema'
import {and, eq} from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    // 检查用户认证
    const user = event.context.user

    if (!user) {
        throw createError({
            statusCode: 401,
            message: '需要登录才能撤回歌曲'
        })
    }

    const body = await readBody(event)

    if (!body.songId) {
        throw createError({
            statusCode: 400,
            message: '歌曲ID不能为空'
        })
    }

    // 查找歌曲
    const songResult = await db.select().from(songs).where(eq(songs.id, body.songId)).limit(1)
    const song = songResult[0]

    if (!song) {
        throw createError({
            statusCode: 404,
            message: '歌曲不存在'
        })
    }

    // 检查是否是用户自己的投稿
    if (song.requesterId !== user.id && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        throw createError({
            statusCode: 403,
            message: '只能撤回自己的投稿'
        })
    }

    // 检查歌曲是否已经播放
    if (song.played) {
        throw createError({
            statusCode: 400,
            message: '已播放的歌曲不能撤回'
        })
    }

    // 检查歌曲是否已排期（只检查已发布的排期，草稿不算）
    const scheduleResult = await db.select().from(schedules).where(and(
        eq(schedules.songId, body.songId),
        eq(schedules.isDraft, false)
    )).limit(1)
    const schedule = scheduleResult[0]

    if (schedule) {
        throw createError({
            statusCode: 400,
            message: '已排期的歌曲不能撤回'
        })
    }

    // 获取系统设置以检查限制类型
    const settingsResult = await db.select().from(systemSettings).limit(1)
    const settings = settingsResult[0]
    const dailyLimit = settings?.dailySubmissionLimit || 0
    const weeklyLimit = settings?.weeklySubmissionLimit || 0

    // 检查撤销的歌曲是否在当前限制期间内（用于返还配额）
    let canReturnQuota = false
    const now = new Date()

    if (dailyLimit > 0) {
        // 检查是否在同一天
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

        if (song.createdAt >= startOfDay && song.createdAt < endOfDay) {
            canReturnQuota = true
        }
    } else if (weeklyLimit > 0) {
        // 检查是否在同一周（周一开始）
        const startOfWeek = new Date(now)
        const dayOfWeek = now.getDay()
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 周一为一周开始
        startOfWeek.setDate(now.getDate() - daysToSubtract)
        startOfWeek.setHours(0, 0, 0, 0)

        const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)

        if (song.createdAt >= startOfWeek && song.createdAt < endOfWeek) {
            canReturnQuota = true
        }
    }

    // 删除歌曲的所有投票
    await db.delete(votes).where(eq(votes.songId, body.songId))

    if (song.hitRequestId) {
        const hitRequestTimeResult = await db.select().from(requestTimes).where(eq(requestTimes.id, song.hitRequestId))
        const hitRequestTime = hitRequestTimeResult[0]
        if (hitRequestTime) {
            const accepted = hitRequestTime.accepted
            await db.update(requestTimes).set({
                accepted: accepted - 1,
            }).where(eq(requestTimes.id, song.hitRequestId))
        }
    }
    // 删除歌曲
    await db.delete(songs).where(eq(songs.id, body.songId))

    // 清除歌曲列表缓存
    await cacheService.clearSongsCache()
    console.log('[Cache] 歌曲缓存已清除（撤回歌曲）')

    return {
        message: canReturnQuota ? '歌曲已成功撤回，投稿配额已返还' : '歌曲已成功撤回',
        songId: body.songId,
        quotaReturned: canReturnQuota
    }
})