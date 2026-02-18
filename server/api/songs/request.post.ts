import {
    collaborationLogs,
    db,
    playTimes,
    requestTimes,
    semesters,
    songCollaborators,
    songs,
    systemSettings
} from '~/drizzle/db'
import {and, eq, gt, gte, lt, lte, sql} from 'drizzle-orm'
import {createCollaborationInvitationNotification} from '~~/server/services/notificationService'
import {
    getBeijingEndOfDay,
    getBeijingEndOfWeek,
    getBeijingStartOfDay,
    getBeijingStartOfWeek,
    getBeijingTimeISOString
} from '~/utils/timeUtils'

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
            semester: songs.semester,
            played: songs.played
        }).from(songs).where(eq(songs.semester, currentSemester))

        const matchingSongs = allSongs.filter(song => {
            const songTitle = normalizeForMatch(song.title)
            const songArtist = normalizeForMatch(song.artist)
            return songTitle === normalizedTitle && songArtist === normalizedArtist
        })

        if (matchingSongs.length > 0) {
        const isSuperAdmin = user.role === 'SUPER_ADMIN'
        const hasUnplayedDuplicate = matchingSongs.some(s => !s.played)
        if (!isSuperAdmin || hasUnplayedDuplicate) {
            throw createError({
                statusCode: 400,
                message: `《${body.title}》已经在列表中，不能重复投稿`
            })
        }
    }

    // 检查投稿限额（管理员不受限制）
    const systemSettingsResult = await db.select().from(systemSettings).limit(1)
    const systemSettingsData = systemSettingsResult[0]
    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'

    // 1. 检查强制关闭
    if (systemSettingsData?.forceBlockAllRequests && !isAdmin) {
        throw createError({
            statusCode: 403,
            message: '投稿功能已关闭'
        })
    }

    // 2. 检查投稿时段限制
    let hitRequestTime: any = null
    if (systemSettingsData?.enableRequestTimeLimitation && !isAdmin) {
        // 使用 ISO 字符串格式进行比较，确保数据库能够正确处理
        const currentTime = getBeijingTimeISOString()

        const hitRequestTimeResult = await db.select().from(requestTimes).where(
            and(
                lte(requestTimes.startTime, currentTime),
                gt(requestTimes.endTime, currentTime),
                eq(requestTimes.enabled, true)
            )
        ).limit(1)

        hitRequestTime = hitRequestTimeResult[0]

        if (!hitRequestTime) {
            throw createError({
                statusCode: 403,
                message: '当前不在投稿开放时段'
            })
        }

        if (hitRequestTime.expected > 0 && hitRequestTime.accepted >= hitRequestTime.expected) {
            throw createError({
                statusCode: 403,
                message: `当前时段投稿名额已满（${hitRequestTime.accepted}/${hitRequestTime.expected}）`
            })
        }
    }

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
                let currentCount = 0

                if (limitType === 'daily') {
                    // 检查每日限额（按北京时间计算）
                    const startOfDay = getBeijingStartOfDay()
                    const endOfDay = getBeijingEndOfDay()

                    const dailySongs = await db.select().from(songs).where(
                        and(
                            eq(songs.requesterId, user.id),
                            gte(songs.createdAt, startOfDay),
                            lte(songs.createdAt, endOfDay)
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
                    // 检查每周限额（按北京时间计算）
                    const startOfWeek = getBeijingStartOfWeek()
                    const endOfWeek = getBeijingEndOfWeek()

                    const weeklySongs = await db.select().from(songs).where(
                        and(
                            eq(songs.requesterId, user.id),
                            gte(songs.createdAt, startOfWeek),
                            lte(songs.createdAt, endOfWeek)
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

        // 准备发送通知的列表
        const notificationsToSend: { userId: number, songId: number, songTitle: string }[] = []

        // 创建歌曲和更新状态（使用事务）
        const song = await db.transaction(async (tx) => {
            // 如果有时段限制，再次检查并更新已接纳数量
            if (hitRequestTime) {
                const latestRequestTimeResult = await tx.select().from(requestTimes)
                    .where(eq(requestTimes.id, hitRequestTime.id))
                    .limit(1)
                const latestRequestTime = latestRequestTimeResult[0]

                if (!latestRequestTime || !latestRequestTime.enabled) {
                    throw createError({ statusCode: 403, message: '投稿时段已失效' })
                }

                // 使用原子更新确保并发安全
                const updateResult = await tx.update(requestTimes)
                    .set({
                        accepted: sql`${requestTimes.accepted} + 1`
                    })
                    .where(and(
                        eq(requestTimes.id, hitRequestTime.id),
                        // 如果有限额，确保更新时未超限（针对 expected > 0 的情况）
                        latestRequestTime.expected > 0 ? lt(requestTimes.accepted, latestRequestTime.expected) : undefined
                    ))
                    .returning()

                if (updateResult.length === 0) {
                    throw createError({ statusCode: 403, message: '当前时段投稿名额已满' })
                }
            }

            // 创建歌曲
            let finalMusicId = body.musicId ? String(body.musicId) : null
            
            // 如果是 Bilibili 平台，处理 musicId 格式
            if (body.musicPlatform === 'bilibili') {
                const bvId = finalMusicId?.split(':')[0]
                if (bvId) {
                    const musicIdParts = [bvId]
                    if (body.bilibiliCid) {
                        musicIdParts.push(body.bilibiliCid)
                        if (body.bilibiliPage && Number(body.bilibiliPage) > 1) {
                            musicIdParts.push(String(body.bilibiliPage))
                        }
                    }
                    finalMusicId = musicIdParts.join(':')
                }
            }

            const songResult = await tx.insert(songs).values({
                title: body.title,
                artist: body.artist,
                requesterId: user.id,
                preferredPlayTimeId: preferredPlayTime?.id || null,
                semester: currentSemester, // 使用外部获取的学期名称
                cover: body.cover || null,
                musicPlatform: body.musicPlatform || null,
                musicId: finalMusicId,
                playUrl: body.playUrl || null,
                hitRequestId: hitRequestTime?.id || null
            }).returning()
            const newSong = songResult[0]

            // 处理联合投稿人
            if (body.collaborators && Array.isArray(body.collaborators) && body.collaborators.length > 0) {
                // 去重
                const uniqueCollaboratorIds = [...new Set(body.collaborators.map((id: any) => Number(id)))]
                
                for (const collaboratorId of uniqueCollaboratorIds) {
                    // 跳过自己或无效ID
                    if (isNaN(collaboratorId) || collaboratorId === user.id) continue

                    try {
                        // 检查是否已经是联合投稿人
                        const existingCollab = await tx.select().from(songCollaborators)
                            .where(and(
                                eq(songCollaborators.songId, newSong.id),
                                eq(songCollaborators.userId, collaboratorId)
                            ))
                            .limit(1)
                        
                        if (existingCollab.length > 0) continue

                        // 创建联合投稿记录
                        const collabResult = await tx.insert(songCollaborators).values({
                            songId: newSong.id,
                            userId: collaboratorId,
                            status: 'PENDING'
                        }).returning()

                        const collab = collabResult[0]

                        // 记录审计日志
                        await tx.insert(collaborationLogs).values({
                            collaboratorId: collab.id,
                            action: 'INVITE',
                            operatorId: user.id,
                            ipAddress: event.node.req.headers['x-forwarded-for'] as string || event.node.req.socket.remoteAddress
                        })

                        // 添加到通知列表，事务结束后发送
                        notificationsToSend.push({
                            userId: collaboratorId,
                            songId: newSong.id,
                            songTitle: newSong.title
                        })
                    } catch (err) {
                        console.error(`邀请用户 ${collaboratorId} 失败:`, err)
                    }
                }
            }

            return newSong
        })

        // 事务提交成功后，发送通知
        // 即使通知发送失败，也不影响点歌结果
        for (const notification of notificationsToSend) {
            try {
                await createCollaborationInvitationNotification(
                    user.id,
                    notification.userId,
                    notification.songId,
                    notification.songTitle
                )
            } catch (error) {
                console.error(`发送邀请通知给用户 ${notification.userId} 失败:`, error)
            }
        }

        return song
    } catch (error: any) {
        console.error('点歌失败:', error)

        if (error.statusCode) {
            throw error
        } else if (error.message === '未设置活跃学期') {
            throw createError({
                statusCode: 400,
                message: '系统未设置当前活跃学期，请联系管理员'
            })
        } else {
            throw createError({
                statusCode: 500,
                message: '点歌失败，请稍后重试'
            })
        }
    }
})

// 获取当前学期名称
async function getCurrentSemesterName() {
    try {
        // 获取当前活跃的学期
        const currentSemesterResult = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1)
        const currentSemester = currentSemesterResult[0]

        if (currentSemester) {
            return currentSemester.name
        }

        // 如果没有活跃学期，抛出错误
        throw new Error('未设置活跃学期')
    } catch (error) {
        console.error('获取当前学期失败:', error)
        throw error
    }
}
