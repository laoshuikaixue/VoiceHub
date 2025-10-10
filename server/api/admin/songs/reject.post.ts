import {db, requestTimes} from '~/drizzle/db'
import {schedules, songBlacklists, songs, votes} from '~/drizzle/schema'
import {eq} from 'drizzle-orm'
import {cacheService} from '../../../services/cacheService'
import {createSongRejectedNotification} from '../../../services/notificationService'

export default defineEventHandler(async (event) => {
    // 检查用户认证和权限
    const user = event.context.user
    if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        throw createError({
            statusCode: 403,
            message: '没有权限访问'
        })
    }

    const body = await readBody(event)

    if (!body.songId) {
        throw createError({
            statusCode: 400,
            message: '歌曲ID不能为空'
        })
    }

    if (!body.reason || !body.reason.trim()) {
        throw createError({
            statusCode: 400,
            message: '驳回原因不能为空'
        })
    }

    try {
        // 使用事务确保驳回操作的原子性
        const result = await db.transaction(async (tx) => {
            // 在事务中重新检查歌曲是否存在
            const songResult = await tx.select().from(songs).where(eq(songs.id, body.songId)).limit(1)
            const song = songResult[0]

            if (!song) {
                throw createError({
                    statusCode: 404,
                    message: '歌曲不存在或已被删除'
                })
            }

            console.log(`开始驳回歌曲: ${song.title} (ID: ${body.songId})`)

            // 如果选择加入黑名单，先添加到黑名单
            if (body.addToBlacklist) {
                try {
                    await tx.insert(songBlacklists).values({
                        type: 'SONG',
                        value: `${song.title} - ${song.artist}`,
                        reason: `歌曲驳回: ${body.reason.trim()}`,
                        createdBy: user.id
                    })
                    console.log(`歌曲已添加到黑名单`)
                } catch (error) {
                    // 如果黑名单中已存在相同歌曲，忽略错误继续执行
                    console.log(`黑名单添加失败，可能已存在: ${error.message}`)
                }
            }

            // 创建通知给投稿人
            if (song.requesterId) {
                try {
                    await createSongRejectedNotification(
                        song.requesterId,
                        {title: song.title, artist: song.artist},
                        body.reason.trim(),
                        getClientIP(event)
                    )
                    console.log(`已发送驳回通知给用户: ${song.requesterId}`)
                } catch (error) {
                    console.error(`发送通知失败: ${error.message}`)
                    // 通知发送失败不应该阻止驳回操作
                }
            }

            // 删除歌曲的所有投票
            await tx.delete(votes).where(eq(votes.songId, body.songId))
            console.log(`删除了投票记录`)

            // 删除歌曲的所有排期
            await tx.delete(schedules).where(eq(schedules.songId, body.songId))
            console.log(`删除了排期记录`)
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
            const deletedSong = await tx.delete(songs).where(eq(songs.id, body.songId)).returning()
            console.log(`歌曲删除完成`)

            return {
                success: true,
                deletedSong: deletedSong[0],
                addedToBlacklist: body.addToBlacklist,
                notificationSent: !!song.requesterId
            }
        })

        // 清除相关缓存
        await cacheService.clearSongsCache()
        await cacheService.clearSchedulesCache()

        console.log(`歌曲驳回操作完成: ${body.songId}`)

        return {
            success: true,
            message: '歌曲驳回成功',
            data: result
        }

    } catch (error) {
        console.error('驳回歌曲失败:', error)

        // 如果是我们抛出的错误，直接重新抛出
        if (error.statusCode) {
            throw error
        }

        // 其他错误
        throw createError({
            statusCode: 500,
            message: '驳回歌曲失败: ' + error.message
        })
    }
})