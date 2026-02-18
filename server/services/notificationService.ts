import {db} from '~/drizzle/db'
import {
    notifications,
    notificationSettings,
    playTimes,
    schedules,
    songCollaborators,
    songs,
    systemSettings,
    users,
    votes
} from '~/drizzle/schema'
import {and, eq, gte, inArray} from 'drizzle-orm'
import {sendBatchMeowNotifications, sendMeowNotificationToUser} from './meowNotificationService'
import {sendBatchEmailNotifications, sendEmailNotificationToUser} from './smtpService'
import {formatDateTime, getBeijingTime} from '~/utils/timeUtils'

/**
 * 创建联合投稿邀请通知
 */
export async function createCollaborationInvitationNotification(
    inviterId: number,
    inviteeId: number,
    songId: number,
    songTitle: string
) {
    try {
        const inviter = await db.select().from(users).where(eq(users.id, inviterId)).limit(1).then(res => res[0])
        const message = `用户 ${inviter?.name || '未知用户'} 邀请您共同投稿歌曲《${songTitle}》。`

        // 创建通知
        const notificationResult = await db.insert(notifications).values({
            userId: inviteeId,
            type: 'COLLABORATION_INVITE',
            message,
            songId
        }).returning()

        // 发送外部通知（MeoW, Email等）
        try {
            await sendMeowNotificationToUser(
                inviteeId,
                '收到联合投稿邀请',
                message
            )
        } catch (error) {
            console.error('发送 MeoW 通知失败:', error)
        }

        try {
            await sendEmailNotificationToUser(
                inviteeId,
                '收到联合投稿邀请',
                message,
                undefined,
                'notification.collaborationInvite',
                {
                    inviterName: inviter?.name || '未知用户',
                    songTitle: songTitle
                }
            )
        } catch (error) {
            console.error('发送邮件通知失败:', error)
        }

        return notificationResult[0]
    } catch (error) {
        console.error('创建联合投稿邀请通知失败:', error)
        return null
    }
}

/**
 * 创建联合投稿回复通知
 */
export async function createCollaborationResponseNotification(
    inviteeId: number,
    inviterId: number,
    songTitle: string,
    accepted: boolean
) {
    try {
        const invitee = await db.select().from(users).where(eq(users.id, inviteeId)).limit(1).then(res => res[0])
        const actionText = accepted ? '接受' : '拒绝'
        const message = `用户 ${invitee?.name || '未知用户'} ${actionText}了您的歌曲《${songTitle}》的联合投稿邀请。`

        // 创建通知
        const notificationResult = await db.insert(notifications).values({
            userId: inviterId,
            type: 'COLLABORATION_RESPONSE',
            message,
            // songId // 这里可能不需要songId，或者需要传进来
        }).returning()

        return notificationResult[0]
    } catch (error) {
        console.error('创建联合投稿回复通知失败:', error)
        return null
    }
}

/**
 * 创建歌曲被选中的通知
 */
export async function createSongSelectedNotification(userId: number, songId: number, songInfo: {
    title: string,
    artist: string,
    playDate: Date
}, ipAddress?: string) {
    try {
        // 获取系统设置，检查是否启用播出时段功能
        const systemSettingsResult = await db.select().from(systemSettings).limit(1)
        const systemConfig = systemSettingsResult[0]
        const isPlayTimeEnabled = systemConfig?.enablePlayTimeSelection || false

        // 获取排期对应的播出时段
        const scheduleResult = await db.select({
            id: schedules.id,
            songId: schedules.songId,
            playDate: schedules.playDate,
            playTimeId: schedules.playTimeId,
            playTime: {
                id: playTimes.id,
                name: playTimes.name,
                startTime: playTimes.startTime,
                endTime: playTimes.endTime
            }
        })
            .from(schedules)
            .leftJoin(playTimes, eq(schedules.playTimeId, playTimes.id))
            .where(and(eq(schedules.songId, songId), eq(schedules.playDate, songInfo.playDate)))
            .limit(1)
        const schedule = scheduleResult[0]

        // 获取用户通知设置
        const settingsResult = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1)
        const settings = settingsResult[0]

        // 如果用户关闭了此类通知，则不发送
        if (settings && !settings.enabled) {
            return null
        }

        // 创建通知，根据播出时段功能启用状态决定显示内容
        let message = `您投稿的歌曲《${songInfo.title}》已被安排播放，播放日期：${formatDate(songInfo.playDate)}。`

        // 只有在启用播出时段功能且有播出时段信息时，才添加播出时段详情
        if (isPlayTimeEnabled && schedule?.playTime) {
            let timeInfo = '';

            // 根据开始和结束时间的情况，格式化显示
            if (schedule.playTime.startTime && schedule.playTime.endTime) {
                timeInfo = `(${schedule.playTime.startTime}-${schedule.playTime.endTime})`;
            } else if (schedule.playTime.startTime) {
                timeInfo = `(开始时间：${schedule.playTime.startTime})`;
            } else if (schedule.playTime.endTime) {
                timeInfo = `(结束时间：${schedule.playTime.endTime})`;
            }

            message += `播出时段：${schedule.playTime.name}${timeInfo ? ' ' + timeInfo : ''}。`;
        }

        let notification
        try {
            const notificationResult = await db.insert(notifications).values({
                userId,
                type: 'SONG_SELECTED',
                message,
                songId
            }).returning()
            notification = notificationResult[0]
        } catch (error) {
            throw error
        }

        // 同步发送 MeoW 通知
        try {
            await sendMeowNotificationToUser(
                userId,
                '收到新选中',
                message
            )
        } catch (error) {
            console.error('发送 MeoW 通知失败:', error)
        }

        // 同步发送 邮件通知
        try {
            await sendEmailNotificationToUser(
                userId,
                '歌曲被选中',
                message,
                ipAddress,
                'notification.songSelected',
                {
                    songTitle: songInfo.title,
                    playDate: formatDate(songInfo.playDate),
                    playTimeName: isPlayTimeEnabled && schedule?.playTime ? schedule.playTime.name : '',
                    playTimeRange: isPlayTimeEnabled && schedule?.playTime && (schedule.playTime.startTime || schedule.playTime.endTime)
                        ? `${schedule.playTime.startTime || ''}${schedule.playTime.startTime && schedule.playTime.endTime ? '-' : ''}${schedule.playTime.endTime || ''}`
                        : ''
                }
            )
        } catch (error) {
            console.error('发送邮件通知失败:', error)
        }

        return notification
    } catch (err) {
        return null
    }
}

// 格式化日期为 yyyy-MM-dd 格式（北京时间）
function formatDate(date: Date): string {
    return formatDateTime(date, 'YYYY-MM-DD')
}

/**
 * 创建歌曲已播放的通知
 */
export async function createSongPlayedNotification(songId: number, ipAddress?: string) {
    try {
        // 获取歌曲信息
        const songResult = await db.select().from(songs).where(eq(songs.id, songId)).limit(1)
        const song = songResult[0]

        if (!song) {
            return null
        }

        // 获取用户通知设置
        const settingsResult = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, song.requesterId)).limit(1)
        const settings = settingsResult[0]

        // 如果用户关闭了此类通知，则不发送
        if (settings && !settings.songPlayedEnabled) {
            return null
        }

        // 创建通知
        const message = `您投稿的歌曲《${song.title}》已播放。`

        // 获取所有关联用户（投稿人 + 联合投稿人）
        const userIdsToNotify = [song.requesterId]

        // 获取联合投稿人
        const collaborators = await db.select().from(songCollaborators)
            .where(and(
                eq(songCollaborators.songId, songId),
                eq(songCollaborators.status, 'ACCEPTED')
            ))

        collaborators.forEach(c => {
            if (!userIdsToNotify.includes(c.userId)) {
                userIdsToNotify.push(c.userId)
            }
        })

        const notificationsCreated = []

        for (const targetUserId of userIdsToNotify) {
            try {
                // 获取用户通知设置
                const settingsResult = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, targetUserId)).limit(1)
                const settings = settingsResult[0]

                // 如果用户关闭了此类通知，则不发送
                if (settings && !settings.songPlayedEnabled) {
                    continue
                }

                const userMessage = targetUserId === song.requesterId
                    ? message
                    : `您参与联合投稿的歌曲《${song.title}》已播放。`

                const notificationResult = await db.insert(notifications).values({
                    userId: targetUserId,
                    type: 'SONG_PLAYED',
                    message: userMessage,
                    songId: songId
                }).returning()
                notificationsCreated.push(notificationResult[0])

                // 同步发送 MeoW 通知
                try {
                    await sendMeowNotificationToUser(
                        targetUserId,
                        '歌曲已播放',
                        userMessage
                    )
                } catch (error) {
                    console.error(`发送 MeoW 通知失败 (User: ${targetUserId}):`, error)
                }

                // 同步发送 邮件通知
                try {
                    await sendEmailNotificationToUser(
                        targetUserId,
                        '歌曲已播放',
                        userMessage,
                        ipAddress,
                        'notification.songPlayed',
                        {songTitle: song.title}
                    )
                } catch (error) {
                    console.error(`发送邮件通知失败 (User: ${targetUserId}):`, error)
                }
            } catch (err) {
                console.error(`处理播放通知失败 (User: ${targetUserId}):`, err)
            }
        }

        return notificationsCreated.length > 0 ? notificationsCreated[0] : null
    } catch (err) {
        return null
    }
}

/**
 * 创建歌曲获得投票的通知
 */
export async function createSongVotedNotification(songId: number, voterId: number, ipAddress?: string) {
    try {
        // 获取歌曲信息
        const songResult = await db.select().from(songs).where(eq(songs.id, songId)).limit(1)
        const song = songResult[0]

        if (!song) {
            return null
        }

        // 获取歌曲的投票信息
        const songVotes = await db.select().from(votes).where(eq(votes.songId, songId))

        // 获取投票用户信息
        const voterResult = await db.select().from(users).where(eq(users.id, voterId)).limit(1)
        const voter = voterResult[0]

        if (!voter) {
            return null
        }

        // 获取用户通知设置
        const settingsResult = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, song.requesterId)).limit(1)
        const settings = settingsResult[0]

        // 如果用户关闭了此类通知，则不发送
        if (settings && !settings.songVotedEnabled) {
            return null
        }

        // 不要给自己投票发通知
        if (song.requesterId === voterId) {
            return null
        }

        // 检查投票阈值
        const threshold = settings?.songVotedThreshold || 1
        if (songVotes.length % threshold !== 0) {
            return null
        }

        const message = `您投稿的歌曲《${song.title}》获得了一个新的投票，当前共有 ${songVotes.length} 个投票。`

        // 防重复通知：检查最近5分钟内是否有相同歌曲的投票通知
        const fiveMinutesAgo = new Date(getBeijingTime().getTime() - 5 * 60 * 1000)

        const existingNotificationResult = await db.select().from(notifications)
            .where(and(
                eq(notifications.userId, song.requesterId),
                eq(notifications.type, 'SONG_VOTED'),
                eq(notifications.songId, songId),
                eq(notifications.read, false),
                gte(notifications.createdAt, fiveMinutesAgo)
            ))
            .orderBy(notifications.createdAt)
            .limit(1)
        const existingNotification = existingNotificationResult[0]

        let notification
        if (existingNotification) {
            // 更新现有通知
            const updateResult = await db.update(notifications)
                .set({
                    message
                })
                .where(eq(notifications.id, existingNotification.id))
                .returning()
            notification = updateResult[0]
        } else {
            // 创建新通知
            const createResult = await db.insert(notifications).values({
                userId: song.requesterId,
                type: 'SONG_VOTED',
                message,
                songId: songId
            }).returning()
            notification = createResult[0]
        }

        // 同步发送 MeoW 通知
        try {
            await sendMeowNotificationToUser(
                song.requesterId,
                '收到新投票',
                message
            )
        } catch (error) {
            console.error('发送 MeoW 通知失败:', error)
        }

        // 同步发送 邮件通知
        try {
            await sendEmailNotificationToUser(
                song.requesterId,
                '收到新投票',
                message,
                ipAddress,
                'notification.songVoted',
                {songTitle: song.title, votesCount: songVotes.length}
            )
        } catch (error) {
            console.error('发送邮件通知失败:', error)
        }

        return notification
    } catch (err) {
        return null
    }
}

/**
 * 创建歌曲驳回通知
 */
export async function createSongRejectedNotification(
    userId: number,
    songInfo: { title: string, artist: string },
    reason: string,
    ipAddress?: string
) {
    try {
        // 获取用户通知设置
        const settingsResult = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1)
        const settings = settingsResult[0]

        // 如果用户关闭了通知，则不发送
        if (settings && !settings.enabled) {
            return null
        }

        // 创建通知消息
        const message = `您投稿的歌曲《${songInfo.title} - ${songInfo.artist}》已被管理员驳回。驳回原因：${reason}`

        // 创建站内通知
        let notification
        try {
            const notificationResult = await db.insert(notifications).values({
                userId,
                type: 'SONG_REJECTED',
                message,
            }).returning()
            notification = notificationResult[0]
        } catch (error) {
            throw error
        }

        // 同步发送 MeoW 通知
        try {
            await sendMeowNotificationToUser(
                userId,
                '歌曲被驳回',
                message
            )
        } catch (error) {
            console.error('发送 MeoW 通知失败:', error)
        }

        // 同步发送邮件通知
        try {
            await sendEmailNotificationToUser(
                userId,
                '歌曲被驳回',
                message,
                ipAddress,
                'notification.songRejected',
                {
                    songTitle: songInfo.title,
                    songArtist: songInfo.artist,
                    reason: reason
                }
            )
        } catch (error) {
            console.error('发送邮件通知失败:', error)
        }

        return notification
    } catch (err) {
        console.error('创建歌曲驳回通知失败:', err)
        return null
    }
}

/**
 * 创建系统通知
 */
export async function createSystemNotification(userId: number, title: string, content: string, ipAddress?: string) {
    try {
        // 获取用户通知设置
        const settingsResult = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1)
        const settings = settingsResult[0]

        // 如果用户关闭了通知，则不发送
        if (settings && !settings.enabled) {
            return null
        }

        // 创建通知
        const notificationResult = await db.insert(notifications).values({
            userId: userId,
            type: 'SYSTEM_NOTICE',
            message: content
        }).returning()
        const notification = notificationResult[0]

        // 同步发送 MeoW 通知
        try {
            await sendMeowNotificationToUser(
                userId,
                title,
                content
            )
        } catch (error) {
            console.error('发送 MeoW 通知失败:', error)
        }

        // 同步发送邮件通知
        try {
            await sendEmailNotificationToUser(
                userId,
                title,
                content,
                undefined,
                undefined,
                undefined,
                ipAddress
            )
        } catch (error) {
            console.error('发送邮件通知失败:', error)
        }

        return notification
    } catch (err) {
        return null
    }
}

/**
 * 批量创建系统通知
 */
export async function createBatchSystemNotifications(
    userIds: number[],
    title: string,
    content: string,
    ipAddress?: string
) {
    try {
        if (!userIds.length) {
            return []
        }

        // 获取用户通知设置
        const userSettings = await db.select().from(notificationSettings).where(inArray(notificationSettings.userId, userIds))

        // 构建用户ID到通知设置的映射
        const settingsMap = new Map()
        userSettings.forEach(setting => {
            settingsMap.set(setting.userId, setting)
        })

        // 准备要创建的通知数据
        const notificationsToCreate = []

        for (const userId of userIds) {
            const settings = settingsMap.get(userId)

            // 如果用户关闭了通知，则不发送
            if (settings && !settings.enabled) {
                continue
            }

            notificationsToCreate.push({
                userId,
                type: 'SYSTEM_NOTICE',
                message: content
            })
        }

        // 如果没有可发送的通知，直接返回
        if (notificationsToCreate.length === 0) {
            return []
        }

        // 批量创建通知
        const createdNotifications = await db.insert(notifications).values(notificationsToCreate).returning()
        const notificationCount = {count: createdNotifications.length}

        // 同步发送 MeoW 通知
        let meowResults = {success: 0, failed: 0}
        try {
            meowResults = await sendBatchMeowNotifications(
                userIds,
                title,
                content
            )
        } catch (error) {
            console.error('批量发送 MeoW 通知失败:', error)
        }

        // 同步发送邮件通知
        let emailResults = {success: 0, failed: 0}
        try {
            emailResults = await sendBatchEmailNotifications(
                userIds,
                title,
                content,
                undefined,
                undefined,
                ipAddress
            )
        } catch (error) {
            console.error('批量发送邮件通知失败:', error)
        }

        return {
            count: notificationCount.count,
            total: userIds.length,
            meowNotifications: meowResults,
            emailNotifications: emailResults
        }
    } catch (err) {
        return null
    }
}

/**
 * 创建重播申请拒绝通知
 */
export async function createReplayRequestRejectedNotification(
    userId: number,
    songInfo: { title: string, artist: string },
    ipAddress?: string
) {
    try {
        // 获取用户通知设置
        const settingsResult = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1)
        const settings = settingsResult[0]

        // 如果用户关闭了通知，则不发送
        if (settings && !settings.enabled) {
            return null
        }

        // 创建通知消息
        const message = `您的重播申请《${songInfo.title}》已被管理员拒绝。`

        // 创建站内通知
        let notification
        try {
            const notificationResult = await db.insert(notifications).values({
                userId,
                type: 'REPLAY_REJECTED',
                message,
            }).returning()
            notification = notificationResult[0]
        } catch (error) {
            throw error
        }

        // 同步发送 MeoW 通知
        try {
            await sendMeowNotificationToUser(
                userId,
                '重播申请已拒绝',
                message
            )
        } catch (error) {
            console.error('发送 MeoW 通知失败:', error)
        }

        // 同步发送邮件通知
        try {
            await sendEmailNotificationToUser(
                userId,
                '重播申请已拒绝',
                message,
                ipAddress
            )
        } catch (error) {
            console.error('发送邮件通知失败:', error)
        }

        return notification
    } catch (err) {
        console.error('创建重播申请拒绝通知失败:', err)
        return null
    }
}