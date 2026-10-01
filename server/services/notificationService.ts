import { db } from '~/drizzle/db'
import {
  notifications,
  notificationSettings,
  playTimes,
  schedules,
  songCollaborators,
  songs,
  users,
  votes
} from '~/drizzle/schema'
import { and, eq, gte, inArray } from 'drizzle-orm'
import { sendBatchMeowNotifications, sendMeowNotificationToUser } from './meowNotificationService'
import { sendBatchEmailNotifications, sendEmailNotificationToUser } from './smtpService'
import { formatDateTime, getBeijingTime } from '~/utils/timeUtils'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import {
  createNotificationSenderSnapshot,
  resolveNotificationSource,
  shouldDeliverSystemNotification,
  type NotificationSenderInput
} from '~~/server/utils/important-notification-policy'
import { randomUUID } from 'node:crypto'

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
    const inviter = await db
      .select()
      .from(users)
      .where(eq(users.id, inviterId))
      .limit(1)
      .then((res) => res[0])
    const message = `用户 ${inviter?.name || '未知用户'} 邀请您共同投稿歌曲《${songTitle}》。`

    // 创建通知
    const notificationResult = await db
      .insert(notifications)
      .values({
        userId: inviteeId,
        type: 'COLLABORATION_INVITE',
        message,
        songId
      })
      .returning()

    // 发送外部通知（MeoW, Email等）
    try {
      await sendMeowNotificationToUser(inviteeId, '收到联合投稿邀请', message)
    } catch (error) {
      console.error('发送 MeoW 通知失败:', error)
    }

    // 同步发送邮件通知
    try {
      await sendEmailNotificationToUser(
        inviteeId,
        '收到联合投稿邀请',
        message,
        undefined,
        'notification.collaborationInvite',
        {
          inviterName: inviter?.name || '未知用户',
          songTitle
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
    const invitee = await db
      .select()
      .from(users)
      .where(eq(users.id, inviteeId))
      .limit(1)
      .then((res) => res[0])
    const actionText = accepted ? '接受' : '拒绝'
    const message = `用户 ${invitee?.name || '未知用户'} ${actionText}了您的歌曲《${songTitle}》的联合投稿邀请。`

    // 创建通知
    const notificationResult = await db
      .insert(notifications)
      .values({
        userId: inviterId,
        type: 'COLLABORATION_RESPONSE',
        message
        // songId // 这里可能不需要songId，或者需要传进来
      })
      .returning()

    return notificationResult[0]
  } catch (error) {
    console.error('创建联合投稿回复通知失败:', error)
    return null
  }
}

type SongSelectedKind = 'submission' | 'replay'

/**
 * 入选通知条目：一条通知可包含同一用户同一天入选的多首歌曲
 */
export interface SongSelectedEntry {
  userId: number
  songId: number
  songInfo: {
    title: string
    artist: string
    playDate: Date
  }
  scheduleId?: number | null
}

const SONG_SELECTED_TEXT: Record<
  SongSelectedKind,
  {
    meowTitle: string
    emailTitle: string
    emailTemplateKey: string
    buildMessage: (mergedSongTitle: string, playDate: string) => string
  }
> = {
  submission: {
    meowTitle: '收到新选中',
    emailTitle: '歌曲被选中',
    emailTemplateKey: 'notification.songSelected',
    buildMessage: (mergedSongTitle, playDate) =>
      `您投稿的歌曲《${mergedSongTitle}》已被安排播放，播放日期：${playDate}。`
  },
  replay: {
    meowTitle: '重播已安排',
    emailTitle: '重播申请已安排',
    emailTemplateKey: 'notification.replaySongSelected',
    buildMessage: (mergedSongTitle, playDate) =>
      `您申请重播的歌曲《${mergedSongTitle}》已安排播放，播放日期：${playDate}。`
  }
}

interface SongSelectedGroup {
  userId: number
  playDate: Date
  songIds: number[]
  songTitles: string[]
  scheduleIds: number[]
}

/**
 * 按用户 + 播放日期分组，同一天多首歌曲只发一条通知
 */
function groupSongSelectedEntries(entries: SongSelectedEntry[]): SongSelectedGroup[] {
  const groups = new Map<string, SongSelectedGroup>()
  for (const entry of entries) {
    const key = `${entry.userId}|${formatDate(entry.songInfo.playDate)}`
    let group = groups.get(key)
    if (!group) {
      group = {
        userId: entry.userId,
        playDate: entry.songInfo.playDate,
        songIds: [],
        songTitles: [],
        scheduleIds: []
      }
      groups.set(key, group)
    }
    group.songIds.push(entry.songId)
    group.songTitles.push(entry.songInfo.title)
    if (entry.scheduleId) {
      group.scheduleIds.push(entry.scheduleId)
    }
  }
  return [...groups.values()]
}

/**
 * 发送一条入选通知（站内 + MeoW + 邮件），多首歌曲时歌曲名以《A、B、C》合并
 */
async function sendSongSelectedNotification(
  kind: SongSelectedKind,
  group: SongSelectedGroup
) {
  try {
    const text = SONG_SELECTED_TEXT[kind]
    const { userId, playDate, songIds, songTitles, scheduleIds } = group

    // 获取系统设置，检查是否启用播出时段功能
    const systemConfig = await getSystemSettingsCached()
    const isPlayTimeEnabled = systemConfig?.enablePlayTimeSelection || false

    // 优先按排期 ID 取播出时段，避免同日同歌多排期时取错时段
    const whereClause =
      scheduleIds.length === songIds.length
        ? inArray(schedules.id, scheduleIds)
        : and(inArray(schedules.songId, songIds), eq(schedules.playDate, playDate))

    // 获取排期对应的播出时段
    const scheduleResult = await db
      .select({
        playTime: {
          id: playTimes.id,
          name: playTimes.name,
          startTime: playTimes.startTime,
          endTime: playTimes.endTime
        }
      })
      .from(schedules)
      .leftJoin(playTimes, eq(schedules.playTimeId, playTimes.id))
      .where(whereClause)
      .limit(1)
    const playTime = scheduleResult[0]?.playTime

    // 获取用户通知设置
    const settingsResult = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId))
      .limit(1)
    const settings = settingsResult[0]

    // 如果用户关闭了此类通知，则不发送
    if (settings && !settings.enabled) {
      return null
    }

    const songTitleText = songTitles.join('、')
    const playDateText = formatDate(playDate)

    // 创建通知，根据播出时段功能启用状态决定显示内容
    let message = text.buildMessage(songTitleText, playDateText)

    // 只有在启用播出时段功能且有播出时段信息时，才添加播出时段详情
    if (isPlayTimeEnabled && playTime) {
      let timeInfo = ''

      // 根据开始和结束时间的情况，格式化显示
      if (playTime.startTime && playTime.endTime) {
        timeInfo = `(${playTime.startTime}-${playTime.endTime})`
      } else if (playTime.startTime) {
        timeInfo = `(开始时间：${playTime.startTime})`
      } else if (playTime.endTime) {
        timeInfo = `(结束时间：${playTime.endTime})`
      }

      message += `播出时段：${playTime.name}${timeInfo ? ' ' + timeInfo : ''}。`
    }

    const notificationResult = await db
      .insert(notifications)
      .values({
        userId,
        type: 'SONG_SELECTED',
        message,
        // 合并多首歌曲时不再指向单首歌曲
        songId: songIds.length === 1 ? songIds[0]! : null
      })
      .returning()

    // 同步发送 MeoW 通知
    try {
      await sendMeowNotificationToUser(userId, text.meowTitle, message)
    } catch (error) {
      console.error('发送 MeoW 通知失败:', error)
    }

    // 同步发送邮件通知
    try {
      await sendEmailNotificationToUser(
        userId,
        text.emailTitle,
        message,
        undefined,
        text.emailTemplateKey,
        {
          songTitle: songTitleText,
          playDate: playDateText,
          playTimeName: isPlayTimeEnabled && playTime ? playTime.name : '',
          playTimeRange:
            isPlayTimeEnabled && playTime && (playTime.startTime || playTime.endTime)
              ? `${playTime.startTime || ''}${playTime.startTime && playTime.endTime ? '-' : ''}${playTime.endTime || ''}`
              : ''
        }
      )
    } catch (error) {
      console.error('发送邮件通知失败:', error)
    }

    return notificationResult[0]
  } catch (err) {
    return null
  }
}

/**
 * 创建歌曲被选中的通知（同一用户同一天多首歌曲合并为一条）
 */
export async function createSongSelectedNotifications(entries: SongSelectedEntry[]) {
  const results = await Promise.allSettled(
    groupSongSelectedEntries(entries).map((group) =>
      sendSongSelectedNotification('submission', group)
    )
  )
  return results.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []))
}

/**
 * 创建歌曲被选中的通知
 */
export async function createSongSelectedNotification(
  userId: number,
  songId: number,
  songInfo: {
    title: string
    artist: string
    playDate: Date
  }
) {
  const created = await createSongSelectedNotifications([{ userId, songId, songInfo }])
  return created[0] || null
}

/**
 * 创建重播申请已安排排期的通知（发送给重播申请人，同一用户同一天多首歌曲合并为一条）
 */
export async function createReplaySongSelectedNotifications(entries: SongSelectedEntry[]) {
  const results = await Promise.allSettled(
    groupSongSelectedEntries(entries).map((group) =>
      sendSongSelectedNotification('replay', group)
    )
  )
  return results.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []))
}

/**
 * 创建重播申请已安排排期的通知（发送给重播申请人）
 */
export async function createReplaySongSelectedNotification(
  userId: number,
  songId: number,
  songInfo: {
    title: string
    artist: string
    playDate: Date
  },
  scheduleId?: number
) {
  const created = await createReplaySongSelectedNotifications([
    { userId, songId, songInfo, scheduleId }
  ])
  return created[0] || null
}

// 格式化日期为 yyyy-MM-dd 格式（北京时间）
function formatDate(date: Date): string {
  return formatDateTime(date, 'YYYY-MM-DD')
}

/**
 * 创建歌曲已播放的通知（同一用户多首歌曲合并为一条）
 */
export async function createSongPlayedNotifications(songIds: number[]) {
  try {
    if (songIds.length === 0) {
      return []
    }

    // 获取歌曲信息
    const songList = await db.select().from(songs).where(inArray(songs.id, songIds))

    if (songList.length === 0) {
      return []
    }

    // 获取所有歌曲已接受的联合投稿人
    const collaboratorRows = await db
      .select()
      .from(songCollaborators)
      .where(
        and(
          inArray(songCollaborators.songId, songList.map((s) => s.id)),
          eq(songCollaborators.status, 'ACCEPTED')
        )
      )

    // 按用户分组：投稿人取其投稿歌曲，联合投稿人取其参与歌曲
    interface SongPlayedGroup {
      requestedTitles: string[]
      collaboratedTitles: string[]
      songIds: Set<number>
    }
    const groups = new Map<number, SongPlayedGroup>()
    const ensureGroup = (userId: number): SongPlayedGroup => {
      let group = groups.get(userId)
      if (!group) {
        group = { requestedTitles: [], collaboratedTitles: [], songIds: new Set() }
        groups.set(userId, group)
      }
      return group
    }

    for (const song of songList) {
      const group = ensureGroup(song.requesterId)
      group.requestedTitles.push(song.title)
      group.songIds.add(song.id)
    }

    for (const collaborator of collaboratorRows) {
      const song = songList.find((s) => s.id === collaborator.songId)
      if (!song) continue
      // 投稿人不再重复计入联合投稿
      if (song.requesterId === collaborator.userId) continue
      const group = ensureGroup(collaborator.userId)
      group.collaboratedTitles.push(song.title)
      group.songIds.add(song.id)
    }

    const notificationsCreated = []

    for (const [targetUserId, group] of groups) {
      try {
        // 获取用户通知设置
        const settingsResult = await db
          .select()
          .from(notificationSettings)
          .where(eq(notificationSettings.userId, targetUserId))
          .limit(1)
        const settings = settingsResult[0]

        // 如果用户关闭了此类通知，则不发送
        if (settings && !settings.songPlayedEnabled) {
          continue
        }

        // 多首歌曲名以《A、B、C》合并，投稿与联合投稿分别成句
        const messageParts = []
        if (group.requestedTitles.length > 0) {
          messageParts.push(`您投稿的歌曲《${group.requestedTitles.join('、')}》已播放。`)
        }
        if (group.collaboratedTitles.length > 0) {
          messageParts.push(
            `您参与联合投稿的歌曲《${group.collaboratedTitles.join('、')}》已播放。`
          )
        }
        const userMessage = messageParts.join('')
        const songTitleText = [...group.requestedTitles, ...group.collaboratedTitles].join('、')

        // 合并多首歌曲时不再指向单首歌曲
        const singleSongId = group.songIds.size === 1 ? [...group.songIds][0]! : null

        const notificationResult = await db
          .insert(notifications)
          .values({
            userId: targetUserId,
            type: 'SONG_PLAYED',
            message: userMessage,
            songId: singleSongId
          })
          .returning()
        notificationsCreated.push(notificationResult[0])

        // 同步发送 MeoW 通知
        try {
          await sendMeowNotificationToUser(targetUserId, '歌曲已播放', userMessage)
        } catch (error) {
          console.error(`发送 MeoW 通知失败 (User: ${targetUserId}):`, error)
        }

        // 同步发送邮件通知
        try {
          await sendEmailNotificationToUser(
            targetUserId,
            '歌曲已播放',
            userMessage,
            undefined,
            'notification.songPlayed',
            {
              songTitle: songTitleText
            }
          )
        } catch (error) {
          console.error(`发送邮件通知失败 (User: ${targetUserId}):`, error)
        }
      } catch (err) {
        console.error(`处理播放通知失败 (User: ${targetUserId}):`, err)
      }
    }

    return notificationsCreated
  } catch (err) {
    return []
  }
}

/**
 * 创建单首歌曲已播放的通知
 */
export async function createSongPlayedNotification(songId: number) {
  const created = await createSongPlayedNotifications([songId])
  return created[0] || null
}

/**
 * 创建歌曲获得投票的通知
 */
export async function createSongVotedNotification(songId: number, voterId: number) {
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
    const settingsResult = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, song.requesterId))
      .limit(1)
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

    const existingNotificationResult = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, song.requesterId),
          eq(notifications.type, 'SONG_VOTED'),
          eq(notifications.songId, songId),
          eq(notifications.read, false),
          gte(notifications.createdAt, fiveMinutesAgo)
        )
      )
      .orderBy(notifications.createdAt)
      .limit(1)
    const existingNotification = existingNotificationResult[0]

    let notification
    if (existingNotification) {
      // 更新现有通知
      const updateResult = await db
        .update(notifications)
        .set({
          message
        })
        .where(eq(notifications.id, existingNotification.id))
        .returning()
      notification = updateResult[0]
    } else {
      // 创建新通知
      const createResult = await db
        .insert(notifications)
        .values({
          userId: song.requesterId,
          type: 'SONG_VOTED',
          message,
          songId: songId
        })
        .returning()
      notification = createResult[0]
    }

    // 同步发送 MeoW 通知
    try {
      await sendMeowNotificationToUser(song.requesterId, '收到新投票', message)
    } catch (error) {
      console.error('发送 MeoW 通知失败:', error)
    }

    // 同步发送邮件通知
    try {
      await sendEmailNotificationToUser(
        song.requesterId,
        '收到新投票',
        message,
        undefined,
        'notification.songVoted',
        {
          songTitle: song.title,
          votesCount: songVotes.length
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

/**
 * 创建歌曲驳回通知
 */
export async function createSongRejectedNotification(
  userId: number,
  songInfo: { title: string; artist: string },
  reason: string
) {
  try {
    // 获取用户通知设置
    const settingsResult = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId))
      .limit(1)
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
      const notificationResult = await db
        .insert(notifications)
        .values({
          userId,
          type: 'SONG_REJECTED',
          message
        })
        .returning()
      notification = notificationResult[0]
    } catch (error) {
      throw error
    }

    // 同步发送 MeoW 通知
    try {
      await sendMeowNotificationToUser(userId, '歌曲被驳回', message)
    } catch (error) {
      console.error('发送 MeoW 通知失败:', error)
    }

    // 同步发送邮件通知
    try {
      await sendEmailNotificationToUser(
        userId,
        '歌曲被驳回',
        message,
        undefined,
        'notification.songRejected',
        {
          songTitle: `${songInfo.title} - ${songInfo.artist}`,
          reason
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

export async function createSubmissionNoteClearedNotification(
  userIds: number[],
  songInfo: { title: string; artist: string },
  reason?: string
) {
  try {
    const uniqueUserIds = [
      ...new Set(userIds.filter((userId) => Number.isInteger(userId) && userId > 0))
    ]

    if (uniqueUserIds.length === 0) {
      return []
    }

    const title = '歌曲备注已被管理员清空'
    const content = reason?.trim()
      ? `您投稿歌曲《${songInfo.title} - ${songInfo.artist}》的备注已被管理员清空。原因：${reason.trim()}`
      : `您投稿歌曲《${songInfo.title} - ${songInfo.artist}》的备注已被管理员清空。`

    return await createBatchSystemNotifications(uniqueUserIds, title, content)
  } catch (error) {
    console.error('创建歌曲备注清空通知失败:', error)
    return []
  }
}

/**
 * 创建系统通知
 */
export async function createSystemNotification(
  userId: number,
  title: string,
  content: string,
  important = false,
  sender: NotificationSenderInput | null = null
) {
  try {
    const batchId = randomUUID()
    const senderSnapshot = createNotificationSenderSnapshot(sender)
    const source = resolveNotificationSource(sender)
    // 获取用户通知设置
    const settingsResult = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId))
      .limit(1)
    const settings = settingsResult[0]

    // 如果用户关闭了通知，则不发送
    if (!shouldDeliverSystemNotification(important, settings?.enabled)) {
      return null
    }

    // 创建通知
    const notificationResult = await db
      .insert(notifications)
      .values({
        userId: userId,
        type: 'SYSTEM_NOTICE',
        batchId,
        source,
        ...senderSnapshot,
        title,
        message: content,
        important
      })
      .returning()
    const notification = notificationResult[0]

    // 同步发送 MeoW 通知
    try {
      await sendMeowNotificationToUser(userId, title, content)
    } catch (error) {
      console.error('发送 MeoW 通知失败:', error)
    }

    // 同步发送邮件通知
    try {
      await sendEmailNotificationToUser(userId, title, content)
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
  important = false,
  sender: NotificationSenderInput | null = null
) {
  try {
    if (!userIds.length) {
      return []
    }

    const batchId = randomUUID()
    const senderSnapshot = createNotificationSenderSnapshot(sender)
    const source = resolveNotificationSource(sender)

    // 获取用户通知设置
    const userSettings = await db
      .select()
      .from(notificationSettings)
      .where(inArray(notificationSettings.userId, userIds))

    // 构建用户ID到通知设置的映射
    const settingsMap = new Map()
    userSettings.forEach((setting) => {
      settingsMap.set(setting.userId, setting)
    })

    // 准备要创建的通知数据
    const notificationsToCreate = []

    for (const userId of userIds) {
      const settings = settingsMap.get(userId)

      // 如果用户关闭了通知，则不发送
      if (!shouldDeliverSystemNotification(important, settings?.enabled)) {
        continue
      }

      notificationsToCreate.push({
        userId,
        type: 'SYSTEM_NOTICE',
        batchId,
        source,
        ...senderSnapshot,
        title,
        message: content,
        important
      })
    }

    // 如果没有可发送的通知，直接返回
    if (notificationsToCreate.length === 0) {
      return []
    }

    // 批量创建通知
    const createdNotifications = await db
      .insert(notifications)
      .values(notificationsToCreate)
      .returning()
    const notificationCount = { count: createdNotifications.length }

    // 同步发送 MeoW 通知
    let meowResults = { success: 0, failed: 0 }
    try {
      meowResults = await sendBatchMeowNotifications(userIds, title, content)
    } catch (error) {
      console.error('批量发送 MeoW 通知失败:', error)
    }

    // 同步发送邮件通知
    let emailResults = { success: 0, failed: 0 }
    try {
      emailResults = await sendBatchEmailNotifications(userIds, title, content)
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
  songInfo: { title: string; artist: string }
) {
  try {
    // 获取用户通知设置
    const settingsResult = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId))
      .limit(1)
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
      const notificationResult = await db
        .insert(notifications)
        .values({
          userId,
          type: 'REPLAY_REJECTED',
          message
        })
        .returning()
      notification = notificationResult[0]
    } catch (error) {
      throw error
    }

    // 同步发送 MeoW 通知
    try {
      await sendMeowNotificationToUser(userId, '重播申请已拒绝', message)
    } catch (error) {
      console.error('发送 MeoW 通知失败:', error)
    }

    // 同步发送邮件通知
    try {
      await sendEmailNotificationToUser(userId, '重播申请已拒绝', message)
    } catch (error) {
      console.error('发送邮件通知失败:', error)
    }

    return notification
  } catch (err) {
    console.error('创建重播申请拒绝通知失败:', err)
    return null
  }
}
