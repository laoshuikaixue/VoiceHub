import {db, requestTimes} from '~/drizzle/db'
import {schedules, songs, votes} from '~/drizzle/schema'
import {eq} from 'drizzle-orm'
import {cacheService} from '../../../services/cacheService'

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

    try {
        // 使用事务确保删除操作的原子性
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

            console.log(`开始删除歌曲: ${song.title} (ID: ${body.songId})`)

            // 删除歌曲的所有投票
            const deletedVotes = await tx.delete(votes).where(eq(votes.songId, body.songId))
            console.log(`删除了投票记录`)

            // 删除歌曲的所有排期
            const deletedSchedules = await tx.delete(schedules).where(eq(schedules.songId, body.songId))
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
            const deletedSongData = deletedSong[0]

            console.log(`成功删除歌曲: ${deletedSongData?.title}`)

            return {
                message: '歌曲已成功删除',
                songId: body.songId,
                deletedVotes: true,
                deletedSchedules: true
            }
        })

        // 清除相关缓存
        try {
            await cacheService.clearSongsCache()
            if (result.deletedSchedules) {
                await cacheService.clearSchedulesCache()
            }
            console.log('[Cache] 歌曲和排期缓存已清除（删除歌曲）')
        } catch (cacheError) {
            console.warn('[Cache] 清除缓存失败:', cacheError)
        }

        return result

    } catch (error: any) {
        console.error('删除歌曲时发生错误:', error)

        // 如果是已经格式化的错误，直接抛出
        if (error.statusCode) {
            throw error
        }

        // 处理Prisma特定错误
        if (error.code === 'P2025') {
            throw createError({
                statusCode: 404,
                message: '歌曲不存在或已被删除'
            })
        }

        // 其他未知错误
        throw createError({
            statusCode: 500,
            message: '删除歌曲时发生未知错误'
        })
    }
})