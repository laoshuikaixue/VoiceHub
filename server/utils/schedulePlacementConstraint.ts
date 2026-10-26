import { asc, inArray } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { songReplayRequests, songs } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

/** 校验歌曲期望时段与实际排期时段。期望日期仅作自动排期偏好。 */

/** 归一化期望播出时段 ID；非正整数视为未指定 */
function normalizePreferredPlayTimeId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isInteger(num) && num > 0 ? num : null
}

export interface SchedulePlacementItem {
  songId: number
  /** 该条目实际落位的时段；缺省时用批次级时段 */
  playTimeId?: number | null
  /** 可选的重播申请 ID：重播申请自己指定的时段优先级高于歌曲原始投稿时段 */
  replayRequestId?: number | null
}

export interface SchedulePlacementCheckInput {
  /** 批次级目标播出时段 ID；null 表示「整批落在未指定时段」 */
  playTimeId: number | null
  items: SchedulePlacementItem[]
}

export interface SchedulePlacementViolation {
  songId: number
  /** 期望的时段 ID */
  expectedPlayTimeId: number
  /** 该条目实际会落到的时段 */
  actualPlayTimeId: number | null
}

/**
 * 解析每个条目实际落位的时段：条目自带时段优先，否则用批次级时段
 */
export function resolveItemPlayTimeId(
  item: SchedulePlacementItem,
  batchPlayTimeId: number | null
): number | null {
  const explicit = normalizePreferredPlayTimeId(item.playTimeId)
  return explicit ?? normalizePreferredPlayTimeId(batchPlayTimeId)
}

/**
 * 校验排期条目是否满足期望时段约束。
 *
 * 期望时段以「重播申请自己指定的时段」优先，缺省时回退到歌曲投稿时选择的时段。
 */
export async function checkSchedulePlacement(
  input: SchedulePlacementCheckInput,
  database: Pick<typeof db, 'select'> = db
): Promise<SchedulePlacementViolation[]> {
  const songIds = Array.from(new Set(input.items.map((item) => item.songId)))
  if (songIds.length === 0) return []

  const songRows = await database
    .select({
      id: songs.id,
      preferredPlayTimeId: songs.preferredPlayTimeId
    })
    .from(songs)
    .where(inArray(songs.id, songIds))
    .orderBy(asc(songs.id))
    .for('update')

  const songMap = new Map(songRows.map((row) => [row.id, row]))

  // 重播申请自身指定的时段优先级高于歌曲原始投稿的时段
  const replayRequestIds = Array.from(
    new Set(
      input.items
        .map((item) => item.replayRequestId)
        .filter((id): id is number => typeof id === 'number' && id > 0)
    )
  )
  const replayMap = new Map<number, { songId: number; status: string; preferredPlayTimeId: number | null }>()
  if (replayRequestIds.length > 0) {
    const replayRows = await database
      .select({
        id: songReplayRequests.id,
        songId: songReplayRequests.songId,
        status: songReplayRequests.status,
        preferredPlayTimeId: songReplayRequests.preferredPlayTimeId
      })
      .from(songReplayRequests)
      .where(inArray(songReplayRequests.id, replayRequestIds))
    replayRows.forEach((row) => {
      replayMap.set(row.id, { ...row, preferredPlayTimeId: normalizePreferredPlayTimeId(row.preferredPlayTimeId) })
    })
  }

  const violations: SchedulePlacementViolation[] = []
  for (const item of input.items) {
    const song = songMap.get(item.songId)
    if (!song) continue

    const replay = item.replayRequestId != null ? replayMap.get(item.replayRequestId) : undefined
    if (item.replayRequestId != null && (
      !replay || replay.songId !== item.songId || !['PENDING', 'FULFILLED'].includes(replay.status)
    )) {
      throw createApiError(400, SERVER_ERROR_CODES.SONG_REPLAY_INVALID_REQUEST, '重播申请无效或已被处理')
    }
    const expectedPlayTimeId =
      replay?.preferredPlayTimeId ?? normalizePreferredPlayTimeId(song.preferredPlayTimeId)
    if (expectedPlayTimeId === null) continue

    const actualPlayTimeId = resolveItemPlayTimeId(item, input.playTimeId)
    if (actualPlayTimeId === expectedPlayTimeId) continue

    violations.push({ songId: item.songId, expectedPlayTimeId, actualPlayTimeId })
  }

  return violations
}

/**
 * 校验排期落位约束并在存在冲突时抛出错误。
 *
 * @param songTitleMap 歌曲 ID → 标题，用于错误提示
 */
export async function assertSchedulePlacement(
  input: SchedulePlacementCheckInput,
  songTitleMap?: Map<number, string>,
  database: Pick<typeof db, 'select'> = db
): Promise<void> {
  const violations = await checkSchedulePlacement(input, database)
  if (violations.length === 0) return

  const describe = (songId: number) => songTitleMap?.get(songId) || `歌曲#${songId}`
  const detail = violations
    .map((v) => `${describe(v.songId)}(期望时段#${v.expectedPlayTimeId})`)
    .join('、')

  throw createApiError(
    400,
    SERVER_ERROR_CODES.SONG_SCHEDULE_PREFERRED_TIME_MISMATCH,
    `以下歌曲指定了期望播出时段，只能排到该时段：${detail}`,
    { params: [detail] }
  )
}

/**
 * 查询歌曲标题，用于错误提示
 */
export async function loadSongTitleMap(songIds: number[], database: Pick<typeof db, 'select'> = db): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  if (songIds.length === 0) return map
  const rows = await database
    .select({ id: songs.id, title: songs.title })
    .from(songs)
    .where(inArray(songs.id, songIds))
  rows.forEach((row) => map.set(row.id, row.title))
  return map
}
