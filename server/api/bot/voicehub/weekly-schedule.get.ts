import { defineEventHandler, getHeader, getQuery, setResponseHeader } from 'h3'
import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { playTimes, schedules, songCollaborators, songs, systemSettings, users, votes } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { ASTRBOT_TOKEN_HEADER, equalAstrbotToken } from '~~/server/utils/astrbot-notification'
import { getServerDate } from '~~/server/utils/serverTime'
import { formatDateTime, getBeijingStartOfWeek, getBeijingEndOfWeek, getBeijingWeekdayLabel } from '~/utils/timeUtils'
import { SYSTEM_SETTINGS_DEFAULTS } from '~~/server/utils/system-settings-defaults'

type WeeklyScheduleItem = {
  date: string
  playTime: string
  sequence: number
  title: string
  artist: string
  requester: string
  voteCount: number
}

/** 将结构化歌单转为机器人可直接发送的纯文本。 */
export function formatAstrbotWeeklyScheduleText(
  siteTitle: string,
  weekRange: string,
  schedules: WeeklyScheduleItem[],
  displayConfig: Record<string, unknown>
) {
  const lines = [`${siteTitle} 本周歌单`, weekRange]
  if (!schedules.length) return `${lines.join('\n')}\n\n暂无已发布排期`

  lines.push('')
  for (const item of schedules) {
    const prefix = displayConfig.showSequence === true ? `${item.sequence}. ` : ''
    const date = displayConfig.showDate === true ? `${item.date} ` : ''
    const playTime = displayConfig.showPlayTime === true && item.playTime ? `｜${item.playTime}` : ''
    const requester = displayConfig.showRequester === true && item.requester ? `｜投稿：${item.requester}` : ''
    const votes = displayConfig.showVotes === true ? `｜热度：${item.voteCount}` : ''
    const title = displayConfig.showTitle === true ? item.title : ''
    const artist = displayConfig.showArtist === true ? item.artist : ''
    const song = [title, artist].filter(Boolean).join(' - ')
    lines.push(`${date}${prefix}${song || item.title}${playTime}${requester}${votes}`)
  }
  return lines.join('\n')
}

/**
 * 机器人本周歌单接口
 *
 * 返回北京时间本周（周一~周日）已发布排期，附投票数、联合投稿人等信息。
 */
export default defineEventHandler(async (event) => {
  // 鉴权：机器人专用令牌
  const [settings] = await db
    .select({
      token: systemSettings.astrbotToken,
      enabled: systemSettings.astrbotEnabled,
      siteTitle: systemSettings.siteTitle,
      siteLogoUrl: systemSettings.siteLogoUrl,
      schoolLogoPrintUrl: systemSettings.schoolLogoPrintUrl,
      weeklyConfig: systemSettings.astrbotWeeklyConfig,
    })
    .from(systemSettings)
    .limit(1)

  if (!settings?.enabled || !equalAstrbotToken(getHeader(event, ASTRBOT_TOKEN_HEADER) ?? '', settings.token ?? '')) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')
  }

  const now = getServerDate()

  // 北京时间本周一 00:00 → 下周一 00:00（UTC）
  const weekStart = getBeijingStartOfWeek(now)
  const weekEnd = new Date(getBeijingEndOfWeek(now).getTime() + 1)

  // 用于 weekRange 展示
  const weekRange = `${formatDateTime(weekStart, 'YYYY/MM/DD')} - ${formatDateTime(getBeijingEndOfWeek(now), 'YYYY/MM/DD')}`

  // 查询本周已发布排期，关联 songs / users / playTimes
  const rows = await db
    .select({
      scheduleId: schedules.id,
      playDate: schedules.playDate,
      sequence: schedules.sequence,
      played: schedules.played,
      songId: songs.id,
      title: songs.title,
      artist: songs.artist,
      cover: songs.cover,
      requesterId: users.id,
      requesterName: users.name,
      requesterGrade: users.grade,
      requesterClass: users.class,
      playTimeName: playTimes.name,
    })
    .from(schedules)
    .innerJoin(songs, eq(schedules.songId, songs.id))
    .leftJoin(users, eq(songs.requesterId, users.id))
    .leftJoin(playTimes, eq(schedules.playTimeId, playTimes.id))
    .where(
      and(
        eq(schedules.isDraft, false),
        gte(schedules.playDate, weekStart),
        lt(schedules.playDate, weekEnd),
      )
    )
    .orderBy(asc(schedules.playDate), asc(schedules.sequence))

  // 批量查询投票数
  const songIds = [...new Set(rows.map((r) => r.songId))]
  const voteCountMap = new Map<number, number>()
  if (songIds.length > 0) {
    const voteCounts = await db
      .select({
        songId: votes.songId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(votes)
      .where(inArray(votes.songId, songIds))
      .groupBy(votes.songId)
    for (const v of voteCounts) {
      voteCountMap.set(v.songId, v.count)
    }
  }

  // 批量查询 ACCEPTED 联合投稿人
  const collaboratorsMap = new Map<number, string[]>()
  if (songIds.length > 0) {
    const collabRows = await db
      .select({
        songId: songCollaborators.songId,
        name: users.name,
      })
      .from(songCollaborators)
      .leftJoin(users, eq(songCollaborators.userId, users.id))
      .where(
        and(
          inArray(songCollaborators.songId, songIds),
          eq(songCollaborators.status, 'ACCEPTED'),
        )
      )
    for (const c of collabRows) {
      if (!collaboratorsMap.has(c.songId)) collaboratorsMap.set(c.songId, [])
      if (c.name) collaboratorsMap.get(c.songId)!.push(c.name)
    }
  }

  // 格式化排期列表
  const scheduleItems = rows.map((row) => {
    const dateLabel = `${formatDateTime(row.playDate, 'YYYY/MM/DD')} ${getBeijingWeekdayLabel(row.playDate)}`

    // 投稿人名称，附联合投稿人后缀
    const collabNames = collaboratorsMap.get(row.songId) ?? []
    const requesterDisplay = collabNames.length > 0
      ? `${row.requesterName ?? ''} & ${collabNames.join('、')}`
      : (row.requesterName ?? '')

    return {
      date: dateLabel,
      playTime: row.playTimeName ?? '',
      sequence: row.sequence,
      title: row.title,
      artist: row.artist,
      cover: row.cover ?? '',
      requester: requesterDisplay,
      requesterGrade: row.requesterGrade ?? '',
      requesterClass: row.requesterClass ?? '',
      voteCount: voteCountMap.get(row.songId) ?? 0,
      played: row.played,
    }
  })

  const displayConfig = Object.fromEntries(
    Object.entries(SYSTEM_SETTINGS_DEFAULTS.astrbotWeeklyConfig).map(([key, fallback]) => [
      key, typeof settings.weeklyConfig?.[key as keyof typeof settings.weeklyConfig] === 'boolean'
        ? settings.weeklyConfig[key as keyof typeof settings.weeklyConfig] : fallback
    ])
  ) as Record<string, unknown>
  const imageConfig = {
    ...displayConfig,
    siteLogoUrl: settings.siteLogoUrl ?? '/assets/logo.png',
    schoolLogoUrl: settings.schoolLogoPrintUrl ?? ''
  }
  const text = formatAstrbotWeeklyScheduleText(
    settings.siteTitle ?? 'VoiceHub', weekRange, scheduleItems, displayConfig
  )

  if (getQuery(event).format === 'text') {
    setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
    return text
  }

  return {
    success: true,
    weekRange,
    generatedAt: formatDateTime(now),
    siteTitle: settings.siteTitle ?? 'VoiceHub',
    schedules: scheduleItems,
    displayConfig,
    imageConfig,
    text,
  }
})
