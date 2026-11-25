import { and, count, eq, gt, inArray, lte } from 'drizzle-orm'
import {
  playTimes,
  schedules,
  songs,
  submissionTopicDays,
  submissionTopicPlayTimes,
  submissionTopics
} from '~/drizzle/schema'
import { formatDateTime, parseToBeijingTime } from '~/utils/timeUtils'
import { createApiError } from '~~/server/utils/apiError'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export const TOPIC_NAME_MAX_LENGTH = 100
export const TOPIC_DESCRIPTION_MAX_LENGTH = 500
export const TOPIC_MAX_SUBMISSIONS_LIMIT = 1000000
export const TOPIC_DAYS_MAX_COUNT = 366
export const TOPIC_PLAY_TIMES_MAX_COUNT = 50

const TOPIC_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/
const TOPIC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** 解析后台 datetime-local 输入（北京时间）并拒绝溢出日期 */
export function parseTopicDateTimeInput(value: unknown): Date | null {
  if (typeof value !== 'string' || !TOPIC_DATE_TIME_PATTERN.test(value.trim())) return null
  const normalized = value.trim()
  const parsed = parseToBeijingTime(normalized)
  if (!parsed || Number.isNaN(parsed.getTime())) return null
  const expected = `${normalized.slice(0, 16)}:00`
  if (formatDateTime(parsed, 'YYYY-MM-DDTHH:mm:ss') !== expected) return null
  return parsed
}

/** 输出后台编辑用的北京时间字符串 */
export function formatTopicDateTimeInput(value: Date | string): string {
  return formatDateTime(value instanceof Date ? value : new Date(value), 'YYYY-MM-DDTHH:mm')
}

/** 校验并去重专题日；非法日期返回 error 而不是静默丢弃 */
export function normalizeTopicDateList(value: unknown): { dates: string[]; error?: string } {
  if (value === undefined || value === null || value === '') return { dates: [] }
  if (!Array.isArray(value)) return { dates: [], error: '专题日必须是日期数组' }
  if (value.length > TOPIC_DAYS_MAX_COUNT) {
    return { dates: [], error: `专题日最多 ${TOPIC_DAYS_MAX_COUNT} 个` }
  }

  const dates = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string' || !TOPIC_DATE_PATTERN.test(item.trim())) {
      return { dates: [], error: '专题日格式必须为 YYYY-MM-DD' }
    }
    const date = item.trim()
    const parsed = new Date(`${date}T00:00:00.000Z`)
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      return { dates: [], error: `专题日 ${date} 无效` }
    }
    dates.add(date)
  }

  return { dates: [...dates].sort() }
}

/** 各专题已收集的歌曲数（删除/撤回歌曲后自动回落） */
export async function getTopicAcceptedCounts(
  dbClient: any,
  topicIds: number[]
): Promise<Map<number, number>> {
  const result = new Map<number, number>()
  if (topicIds.length === 0) return result

  const rows = await dbClient
    .select({ topicId: songs.topicId, value: count() })
    .from(songs)
    .where(inArray(songs.topicId, topicIds))
    .groupBy(songs.topicId)

  for (const row of rows) {
    if (row.topicId != null) result.set(Number(row.topicId), Number(row.value || 0))
  }
  return result
}

/** 专题日配置；未配置专题日的专题不出现在 Map 中，表示不限制排期日期 */
export async function getTopicDayMap(
  dbClient: any,
  topicIds: number[]
): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>()
  if (topicIds.length === 0) return result

  const rows = await dbClient
    .select({ topicId: submissionTopicDays.topicId, date: submissionTopicDays.date })
    .from(submissionTopicDays)
    .where(inArray(submissionTopicDays.topicId, topicIds))
    .orderBy(submissionTopicDays.date)

  for (const row of rows) {
    const topicId = Number(row.topicId)
    if (!result.has(topicId)) result.set(topicId, [])
    result.get(topicId)!.push(String(row.date))
  }
  return result
}

/** 查询专题歌曲的专题日限制，供排期入口统一校验 */
export async function getSongTopicRestrictions(
  dbClient: any,
  songIds: number[]
): Promise<
  Map<number, { topicId: number; topicName: string; days: string[] | null }>
> {
  const result = new Map<
    number,
    { topicId: number; topicName: string; days: string[] | null }
  >()
  if (songIds.length === 0) return result

  const rows = await dbClient
    .select({
      songId: songs.id,
      topicId: songs.topicId,
      topicName: submissionTopics.name
    })
    .from(songs)
    .innerJoin(submissionTopics, eq(songs.topicId, submissionTopics.id))
    .where(inArray(songs.id, songIds))

  const topicIds = [...new Set(rows.map((row: any) => Number(row.topicId)))]
  const dayMap = await getTopicDayMap(dbClient, topicIds)

  for (const row of rows) {
    const topicId = Number(row.topicId)
    result.set(Number(row.songId), {
      topicId,
      topicName: row.topicName || `#${topicId}`,
      days: dayMap.get(topicId) || null
    })
  }
  return result
}

/**
 * 专题歌曲只能排期到其专题日。
 * 专题未配置专题日时视为不限制，避免专题日尚未排定时阻塞排期。
 */
export async function assertSongsScheduleDateAllowed(
  dbClient: any,
  songIds: number[],
  playDate: string,
  titlePrefix = '专题歌曲'
): Promise<void> {
  if (!songIds.length) return
  // 总开关关闭时专题规则不再生效，避免历史专题歌曲永久无法排期
  const settings = await getSystemSettingsCached()
  if (settings?.enableSubmissionTopics !== true) return

  const restrictions = await getSongTopicRestrictions(dbClient, [...new Set(songIds)])
  const blocked: string[] = []

  for (const [songId, restriction] of restrictions) {
    if (!restriction.days || restriction.days.length === 0) continue
    if (restriction.days.includes(playDate)) continue
    blocked.push(`#${songId}（${restriction.topicName}）`)
  }

  if (blocked.length > 0) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.SONG_TOPIC_DAY_INVALID,
      `${titlePrefix}只能排期到所属专题日：${blocked.join('、')}`,
      { params: [playDate] }
    )
  }
}

/** 当前是否存在学生可投的专题（开启中、在时段内、名额未满）；「专题必选」只在有可投专题时才强制 */
export async function hasSubmittableTopic(dbClient: any, now: Date): Promise<boolean> {
  const rows = await dbClient
    .select({ id: submissionTopics.id, maxSubmissions: submissionTopics.maxSubmissions })
    .from(submissionTopics)
    .where(
      and(
        eq(submissionTopics.enabled, true),
        lte(submissionTopics.startTime, now),
        gt(submissionTopics.endTime, now)
      )
    )
  if (rows.length === 0) return false

  const acceptedMap = await getTopicAcceptedCounts(dbClient, rows.map((row) => Number(row.id)))
  return rows.some(
    (row) =>
      row.maxSubmissions === null ||
      (acceptedMap.get(Number(row.id)) || 0) < Number(row.maxSubmissions)
  )
}

/** 校验并去重专题可投稿的播出时段 id；空数组表示不限制时段 */
export function normalizeTopicPlayTimeList(value: unknown): { ids: number[]; error?: string } {
  if (value === undefined || value === null || value === '') return { ids: [] }
  if (!Array.isArray(value)) return { ids: [], error: '投稿时段必须是时段 id 数组' }
  if (value.length > TOPIC_PLAY_TIMES_MAX_COUNT) {
    return { ids: [], error: `投稿时段最多 ${TOPIC_PLAY_TIMES_MAX_COUNT} 个` }
  }

  const ids = new Set<number>()
  for (const item of value) {
    const id = Number(item)
    if (!Number.isInteger(id) || id <= 0) return { ids: [], error: '投稿时段的 id 无效' }
    ids.add(id)
  }
  return { ids: [...ids].sort((a, b) => a - b) }
}

/** 各专题配置的投稿时段 id，按升序返回 */
export async function getTopicPlayTimeMap(
  dbClient: any,
  topicIds: number[]
): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>()
  if (topicIds.length === 0) return result

  const rows = await dbClient
    .select({
      topicId: submissionTopicPlayTimes.topicId,
      playTimeId: submissionTopicPlayTimes.playTimeId
    })
    .from(submissionTopicPlayTimes)
    .where(inArray(submissionTopicPlayTimes.topicId, topicIds))

  for (const row of rows) {
    const topicId = Number(row.topicId)
    const list = result.get(topicId) || []
    list.push(Number(row.playTimeId))
    result.set(topicId, list)
  }
  for (const [topicId, list] of result) {
    result.set(topicId, list.sort((a, b) => a - b))
  }
  return result
}

/** 时段 id 必须真实存在，避免写入悬空关联 */
export async function assertPlayTimesExist(dbClient: any, playTimeIds: number[]): Promise<void> {
  if (playTimeIds.length === 0) return

  const rows = await dbClient
    .select({ id: playTimes.id })
    .from(playTimes)
    .where(inArray(playTimes.id, playTimeIds))
  const found = new Set(rows.map((row: any) => Number(row.id)))
  const missing = playTimeIds.filter((id) => !found.has(id))

  if (missing.length > 0) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      `播出时段不存在：${missing.join('、')}`
    )
  }
}

/** 校验专题日变更后不会与已有排期冲突 */
export async function assertTopicDaysCompatibleWithSchedules(
  dbClient: any,
  topicId: number,
  nextDays: string[]
): Promise<void> {
  if (nextDays.length === 0) return

  const liveRows = await dbClient
    .select({ playDate: schedules.playDate })
    .from(schedules)
    .innerJoin(songs, eq(schedules.songId, songs.id))
    .where(eq(songs.topicId, topicId))

  const allowed = new Set(nextDays)
  const invalid = liveRows
    .map((row: any) => formatDateTime(row.playDate, 'YYYY-MM-DD'))
    .filter((date: string) => !allowed.has(date))

  if (invalid.length > 0) {
    const uniqueDates = [...new Set(invalid)].sort().join('、')
    throw createApiError(
      400,
      SERVER_ERROR_CODES.SONG_TOPIC_DAY_INVALID,
      `已有专题歌曲排期在 ${uniqueDates}，无法移除这些专题日`
    )
  }
}

/** 专题在给定时间是否可投稿 */
export function isTopicOpen(
  topic: { enabled: boolean; startTime: Date | string; endTime: Date | string },
  now: Date
): boolean {
  if (!topic.enabled) return false
  const start = topic.startTime instanceof Date ? topic.startTime : new Date(topic.startTime)
  const end = topic.endTime instanceof Date ? topic.endTime : new Date(topic.endTime)
  return start.getTime() <= now.getTime() && now.getTime() < end.getTime()
}

/** 校验投稿时的专题选择，返回专题记录 */
export async function validateTopicForSubmission(
  dbClient: any,
  topicId: number,
  now: Date,
  options: { playDate?: string | null; playTimeId?: number | string | null; lock?: boolean } = {}
): Promise<any> {
  const query = dbClient
    .select()
    .from(submissionTopics)
    .where(eq(submissionTopics.id, topicId))
    .limit(1)
  const rows = options.lock ? await query.for('update') : await query
  const topic = rows[0]

  if (!topic) {
    throw createApiError(404, SERVER_ERROR_CODES.SONG_TOPIC_NOT_FOUND, '专题不存在')
  }
  if (!isTopicOpen(topic, now)) {
    throw createApiError(403, SERVER_ERROR_CODES.SONG_TOPIC_UNAVAILABLE, '该专题当前不在投稿开放时段')
  }

  const max = topic.maxSubmissions === null || topic.maxSubmissions === undefined
    ? null
    : Number(topic.maxSubmissions)

  const [acceptedRows, dayMap] = await Promise.all([
    max === null ? Promise.resolve(new Map<number, number>()) : getTopicAcceptedCounts(dbClient, [topicId]),
    options.playDate ? getTopicDayMap(dbClient, [topicId]) : Promise.resolve(new Map<number, string[]>())
  ])

  if (max !== null && (acceptedRows.get(topicId) || 0) >= max) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.SONG_TOPIC_FULL,
      `专题「${topic.name}」投稿名额已满`,
      { params: [topic.name] }
    )
  }

  const days = dayMap.get(topicId)
  if (options.playDate && days && days.length > 0 && !days.includes(options.playDate)) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.SONG_TOPIC_DAY_INVALID,
      `专题「${topic.name}」仅支持专题日：${days.join('、')}`,
      { params: [options.playDate] }
    )
  }

  // 专题配置了可投稿时段时，所选时段必须属于其一；未配置则不限
  const playTimeId = options.playTimeId === null || options.playTimeId === undefined
    ? null
    : Number(options.playTimeId)
  if (playTimeId !== null && Number.isInteger(playTimeId) && playTimeId > 0) {
    const playTimeMap = await getTopicPlayTimeMap(dbClient, [topicId])
    const allowed = playTimeMap.get(topicId) || []
    if (allowed.length > 0 && !allowed.includes(playTimeId)) {
      throw createApiError(
        400,
        SERVER_ERROR_CODES.SONG_TOPIC_PLAY_TIME_INVALID,
        `专题「${topic.name}」只接收指定播出时段的投稿`,
        { params: [topic.name] }
      )
    }
  }

  return topic
}
