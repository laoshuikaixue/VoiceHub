import {and, db, eq, gte, lt, playTimes, semesters, songs, systemSettings, requestTimes} from '~/drizzle/db'
import {gt, lte} from "drizzle-orm";

export default defineEventHandler(async (event) => {
    // 检查用户认证
    const user = event.context.user

    if (!user) {
        throw createError({
            statusCode: 401,
            message: '需要登录才能点歌'
        })
    }

    const body = await readBody(event)

    if (!body.title || !body.artist) {
        throw createError({
            statusCode: 400,
            message: '歌曲名称和艺术家不能为空'
        })
    }

    try {
        const systemSettingsResult = await db.select().from(systemSettings).limit(1)
        const systemSettingsData = systemSettingsResult[0]
        const enableRequestTimeLimitation = systemSettingsData?.enableRequestTimeLimitation || false
        const forceBlockAllRequests = systemSettingsData?.forceBlockAllRequests || false
        let hit = false;
        let accepted = 0;
        let expected = 0;
        let hitRequestTimeItem = null

        if (enableRequestTimeLimitation && user.role !== 'SUPER_ADMIN') {
            const now = new Date();

            const hitRequestTimeResult = await db.select().from(requestTimes).where(and(and(lte(requestTimes.startTime, now), gt(requestTimes.endTime, now)), eq(requestTimes.enabled, true))).limit(1)
            const hitRequestTime = hitRequestTimeResult[0]
            hitRequestTimeItem = hitRequestTimeResult[0]

            if (hitRequestTime) {
                hit = true;
                accepted = hitRequestTime?.accepted || 0;
                expected = hitRequestTime?.expected || 0;
            }
        } else {
            hit = true;
        }
        if (forceBlockAllRequests && user.role !== 'SUPER_ADMIN') {
            throw createError({
                statusCode: 403,
                message: '投稿功能已关闭'
            })
        }
        if (enableRequestTimeLimitation && user.role !== 'SUPER_ADMIN' && (!hit || (expected > 0 && accepted >= expected))) {
            throw createError({
                statusCode: 403,
                message: '投稿功能已关闭'
            })
        }
        // 标准化字符串用于精确匹配
        const normalizeForMatch = (str: string): string => {
            return str
                .toLowerCase()
                .replace(/[\s\-_\(\)\[\]【】（）「」『』《》〈〉""''""''、，。！？：；～·]/g, '')
                .replace(/[&＆]/g, 'and')
                .replace(/[feat\.?|ft\.?]/gi, '')
                .trim()
        }

        const normalizedTitle = normalizeForMatch(body.title)
        const normalizedArtist = normalizeForMatch(body.artist)

        // 检查是否已有完全相同的歌曲（标准化后完全匹配，仅限当前学期）
        const currentSemester = await getCurrentSemesterName()
        const allSongs = await db.select({
            id: songs.id,
            title: songs.title,
            artist: songs.artist,
            semester: songs.semester
        }).from(songs).where(eq(songs.semester, currentSemester))

        const existingSong = allSongs.find(song => {
            const songTitle = normalizeForMatch(song.title)
            const songArtist = normalizeForMatch(song.artist)
            return songTitle === normalizedTitle && songArtist === normalizedArtist
        })

        if (existingSong) {
            throw createError({
                statusCode: 400,
                message: `《${body.title}》已经在列表中，不能重复投稿`
            })
        }

        // 检查投稿限额（管理员不受限制）
        const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'

        if (systemSettingsData?.enableSubmissionLimit && !isAdmin) {
            const dailyLimit = systemSettingsData.dailySubmissionLimit
            const weeklyLimit = systemSettingsData.weeklySubmissionLimit

            // 确定生效的限额类型（二选一逻辑）
            let effectiveLimit = null
            let limitType = null

            if (dailyLimit !== null && dailyLimit !== undefined) {
                effectiveLimit = dailyLimit
                limitType = 'daily'
            } else if (weeklyLimit !== null && weeklyLimit !== undefined) {
                effectiveLimit = weeklyLimit
                limitType = 'weekly'
            }

            // 如果生效的限额为0，则关闭投稿
            if (effectiveLimit === 0) {
                throw createError({
                    statusCode: 403,
                    message: '投稿功能已关闭'
                })
            }

            // 如果有生效的限额且大于0，检查使用量
            if (effectiveLimit && effectiveLimit > 0) {
                const now = new Date()
                let currentCount = 0

                if (limitType === 'daily') {
                    // 检查每日限额
                    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

                    const dailySongs = await db.select().from(songs).where(
                        and(
                            eq(songs.requesterId, user.id),
                            gte(songs.createdAt, startOfDay),
                            lt(songs.createdAt, endOfDay)
                        )
                    )
                    currentCount = dailySongs.length

                    if (currentCount >= effectiveLimit) {
                        throw createError({
                            statusCode: 400,
                            message: `每日投稿限额为${effectiveLimit}首，您今日已达到限额`
                        })
                    }
                } else if (limitType === 'weekly') {
                    // 检查每周限额
                    const startOfWeek = new Date(now)
                    const dayOfWeek = now.getDay()
                    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 周一为一周开始
                    startOfWeek.setDate(now.getDate() - daysToSubtract)
                    startOfWeek.setHours(0, 0, 0, 0)

                    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)

                    const weeklySongs = await db.select().from(songs).where(
                        and(
                            eq(songs.requesterId, user.id),
                            gte(songs.createdAt, startOfWeek),
                            lt(songs.createdAt, endOfWeek)
                        )
                    )
                    currentCount = weeklySongs.length

                    if (currentCount >= effectiveLimit) {
                        throw createError({
                            statusCode: 400,
                            message: `每周投稿限额为${effectiveLimit}首，您本周已达到限额`
                        })
                    }
                }
            }
        }

        // 检查期望的播出时段是否存在
        let preferredPlayTime = null
        if (body.preferredPlayTimeId) {
            // 检查系统设置是否允许选择播出时段
            if (!systemSettingsData?.enablePlayTimeSelection) {
                throw createError({
                    statusCode: 400,
                    message: '播出时段选择功能未启用'
                })
            }

            // 检查播出时段是否存在且已启用
            const playTimeResult = await db.select().from(playTimes).where(
                and(
                    eq(playTimes.id, body.preferredPlayTimeId),
                    eq(playTimes.enabled, true)
                )
            ).limit(1)
            preferredPlayTime = playTimeResult[0]

            if (!preferredPlayTime) {
                throw createError({
                    statusCode: 400,
                    message: '选择的播出时段不存在或未启用'
                })
            }
        }

        // 创建歌曲
        const songResult = await db.insert(songs).values({
            title: body.title,
            artist: body.artist,
            requesterId: user.id,
            preferredPlayTimeId: preferredPlayTime?.id || null,
            semester: await getCurrentSemesterName(),
            cover: body.cover || null,
            musicPlatform: body.musicPlatform || null,
            musicId: body.musicId ? String(body.musicId) : null,
            playUrl: body.playUrl || null,
            hitRequestId: hitRequestTimeItem?.id || null,
        }).returning()
        const song = songResult[0]

        if(enableRequestTimeLimitation && user.role !== 'SUPER_ADMIN' && hitRequestTimeItem){
            await db.update(requestTimes).set({
                accepted: accepted + 1
            }).where(eq(requestTimes.id, hitRequestTimeItem.id))
        }

        // 移除了投稿者自动投票的逻辑

        return song
    } catch (error: any) {
        console.error('点歌失败:', error)

        if (error.statusCode) {
            throw error
        } else {
            throw createError({
                statusCode: 500,
                message: '点歌失败，请稍后重试'
            })
        }
    }
})

// 获取当前学期名称（从数据库）
async function getCurrentSemesterName() {
    try {
        // 获取当前活跃的学期
        const currentSemesterResult = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1)
        const currentSemester = currentSemesterResult[0]

        if (currentSemester) {
            return currentSemester.name
        }

        // 如果没有活跃学期，使用默认逻辑
        return getCurrentSemester()
    } catch (error) {
        console.error('获取当前学期失败，使用默认逻辑:', error)
        return getCurrentSemester()
    }
}

// 获取当前学期（后备函数）
function getCurrentSemester() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    // 假设上学期为9-2月，下学期为3-8月
    const term = month >= 3 && month <= 8 ? '下' : '上'

    // 如果是上学期（9-12月），年份应该是当前年份
    // 如果是上学期（1-2月），年份应该是前一年
    // 如果是下学期（3-8月），年份应该是当前年份
    const academicYear = month >= 9 ? year : (month <= 2 ? year - 1 : year)

    return `${academicYear}-${academicYear + 1}学年${term}学期`
}