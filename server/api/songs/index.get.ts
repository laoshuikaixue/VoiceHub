import { createError, defineEventHandler, getQuery } from 'h3'
import type { H3Event } from 'h3'
import { client } from '~/drizzle/db'
import { formatDateTime } from '~/utils/timeUtils'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { SUBMISSION_NOTE_STATUS } from '~~/server/config/constants'
import {
  maskSongsInfo,
  stripAnonymousSongIdentifiers,
  applySubmissionAnonymity,
  type MaskableSong
} from '~~/server/utils/studentMask'
import { formatDisambiguatedName, NAME_DISAMBIGUATION_CTES } from '~~/server/utils/userDisplayName'

interface SongResponse extends MaskableSong {
  id: number
  title: string
  artist: string
  requester: string
  requesterId?: number
  collaborators: any[]
  voteCount: number
  played: boolean
  playedAt: Date | null
  semester: string | null
  createdAt: Date
  updatedAt: Date
  requestedAt: string
  scheduled: boolean
  cover: string | null
  musicPlatform: string | null
  musicId: string | null
  cardCodeId?: number | null
  durationSeconds?: number | null
  playUrl: string | null
  requesterGrade: string | null
  requesterClass: string | null
  replayRequested: boolean
  replayRequestCount: number
  isReplay: boolean
  replayRequesters: any[]
  voted?: boolean
  preferredPlayTimeId?: number | null
  preferredPlayTime?: any
  // 期望播出日期（YYYY-MM-DD），与 preferredPlayTimeId 共同构成「日期 + 时段」
  preferredPlayDate?: string | null
  scheduleDate?: string
  schedulePlayed?: boolean
  replayRequestStatus?: string
  replayRequestUpdatedAt?: Date | string
  replayRequestCooldownRemaining?: number
  hasSubmissionNote?: boolean
  submissionNote?: string | null
  submissionNotePublic?: boolean
  submissionAnonymous?: boolean
  submissionNotePublicStatus?: string | null
  replayRequestId?: number | null
  submissionCount?: number
  playCount?: number
  inPool?: boolean
}

const calculateReplayCooldown = (status?: string | null, updatedAt?: Date | string | null) => {
  if (status !== 'REJECTED' || !updatedAt) return undefined
  const cooldownMs = 24 * 60 * 60 * 1000
  const remainingMs = cooldownMs - (getServerTimestamp() - new Date(updatedAt).getTime())
  return remainingMs > 0 ? Math.ceil(remainingMs / (60 * 60 * 1000)) : 0
}

const isSchemaCompatibilityError = (error: unknown) => {
  const value = error as { code?: string; cause?: { code?: string } } | null
  const code = String(value?.code || value?.cause?.code || '')
  return ['42P01', '42703'].includes(code)
}

const loadBasicSongs = async (
  client: any,
  semester: string,
  grade: string,
  search: string,
  user: any,
  isAdmin: boolean,
  options: {
    scope?: string
    sortBy?: string
    sortOrder?: string
    page?: number
    pageSize?: number
    event?: H3Event | null
  } = {}
) => {
  const conditions: string[] = []
  const params: any[] = []
  const addParam = (value: any) => {
    params.push(value)
    return `$${params.length}`
  }
  const pageSize = Number(options.pageSize) > 0 ? Math.min(Number(options.pageSize), 100) : 0
  const page = Number(options.page) > 0 ? Number(options.page) : 1

  // 探测可选表：缺失时继续降级为仅依赖 Song/User 字段
  const tableRows = await client.unsafe(`
    SELECT
      to_regclass('public."Schedule"') IS NOT NULL AS has_schedule,
      to_regclass('public."Vote"') IS NOT NULL AS has_vote,
      to_regclass('public.song_replay_requests') IS NOT NULL AS has_replay,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Song' AND column_name = 'submissionAnonymous'
      ) AS has_submission_anonymous
  `)
  const tableInfo = tableRows[0] || {}
  const hasSchedule = tableInfo.has_schedule === true
  const hasVote = tableInfo.has_vote === true
  const hasReplay = tableInfo.has_replay === true
  const hasSubmissionAnonymous = tableInfo.has_submission_anonymous === true

  if (search) {
    const value = addParam(`%${search}%`)
    if (hasSubmissionAnonymous) {
      // 匿名投稿不能按真实姓名命中，仅管理员与投稿人本人可按姓名检索
      const requesterNameMatch = isAdmin
        ? `u.name ILIKE ${value}`
        : `((s."submissionAnonymous" = false OR s."requesterId" = ${addParam(
            user?.id ?? null
          )}) AND u.name ILIKE ${value})`
      conditions.push(
        `(s.title ILIKE ${value} OR s.artist ILIKE ${value} OR ${requesterNameMatch})`
      )
    } else {
      conditions.push(`(s.title ILIKE ${value} OR s.artist ILIKE ${value} OR u.name ILIKE ${value})`)
    }
  }
  if (semester) conditions.push(`s.semester = ${addParam(semester)}`)
  if (grade) conditions.push(`u.grade = ${addParam(grade)}`)
  if (options.scope === 'mine' && user) conditions.push(`s."requesterId" = ${addParam(user.id)}`)
  if (options.scope === 'replays' && user && hasReplay) {
    conditions.push(
      `EXISTS (SELECT 1 FROM song_replay_requests rrp WHERE rrp.song_id = s.id AND rrp.user_id = ${addParam(user.id)})`
    )
  }

  let userIdParam: string | null = null
  if (user && hasVote) userIdParam = addParam(user.id)
  let userReplayParam: string | null = null
  if (user && hasReplay) userReplayParam = userIdParam || addParam(user.id)

  const ctes: string[] = []
  if (hasVote) {
    ctes.push(`
      vote_counts AS (
        SELECT "songId", COUNT(*)::int AS vote_count
        FROM "Vote"
        GROUP BY "songId"
      )`)
  }
  if (userIdParam) {
    ctes.push(`
      current_user_votes AS (
        SELECT "songId"
        FROM "Vote"
        WHERE "userId" = ${userIdParam}
        GROUP BY "songId"
      )`)
  }
  if (hasSchedule) {
    ctes.push(`
      published_schedule AS (
        SELECT DISTINCT ON ("songId") "songId"
        FROM "Schedule"
        WHERE "isDraft" = false
        ORDER BY "songId", "playDate" DESC
      )`)
  }
  if (userReplayParam) {
    ctes.push(`
      current_user_replay AS (
        SELECT DISTINCT ON (song_id) song_id, status
        FROM song_replay_requests
        WHERE user_id = ${userReplayParam}
        ORDER BY song_id, created_at DESC
      )`)
  }

  const orderColumn =
    options.sortBy === 'title'
      ? 's.title'
      : options.sortBy === 'artist'
        ? 's.artist'
        : 's."createdAt"'
  const orderDirection = options.sortOrder === 'asc' ? 'ASC' : 'DESC'
  const orderTerms: string[] = []
  // 分页时与主查询保持同样的分组顺序：未排期 → 已排期 → 已播放
  if (pageSize > 0) {
    orderTerms.push(
      hasSchedule
        ? `CASE WHEN s.played THEN 2 WHEN ps."songId" IS NOT NULL THEN 1 ELSE 0 END ASC`
        : `CASE WHEN s.played THEN 2 ELSE 0 END ASC`
    )
  }
  if (options.sortBy === 'votes' && hasVote) {
    orderTerms.push(`COALESCE(vc.vote_count, 0) ${orderDirection}`, `s."createdAt" ASC`)
  } else {
    orderTerms.push(`${orderColumn} ${orderDirection}`)
  }
  if (pageSize > 0) orderTerms.push('s.id ASC')

  const paginationSql =
    pageSize > 0 ? `LIMIT ${addParam(pageSize)} OFFSET ${addParam((page - 1) * pageSize)}` : ''
  // 兜底查询只依赖初始版本就存在的 Song/User 字段，存在可选表时补上投票与排期状态。
  const rows = await client.unsafe(`
    ${ctes.length ? `WITH ${ctes.join(',')}` : ''}
    SELECT s.id, s.title, s.artist, s.played, s."playedAt", s.semester,
      s."createdAt", s."updatedAt", s.cover, s."musicPlatform", s."musicId",
      ${hasSubmissionAnonymous ? 's."submissionAnonymous"' : 'false'} AS "submissionAnonymous",
      u.id AS "requesterId", u.name AS "requesterName", u.grade AS "requesterGrade", u.class AS "requesterClass",
      ${hasVote ? 'COALESCE(vc.vote_count, 0)' : '0'} AS "voteCount",
      ${userIdParam ? '(cuv."songId" IS NOT NULL)' : 'false'} AS voted,
      ${hasSchedule ? '(ps."songId" IS NOT NULL)' : 'false'} AS scheduled,
      ${userReplayParam ? '(cur.song_id IS NOT NULL)' : 'false'} AS "replayRequested",
      ${userReplayParam ? 'cur.status' : 'NULL'} AS "replayRequestStatus",
      COUNT(*) OVER()::int AS total
    FROM "Song" s
    LEFT JOIN "User" u ON u.id = s."requesterId"
    ${hasVote ? 'LEFT JOIN vote_counts vc ON vc."songId" = s.id' : ''}
    ${userIdParam ? 'LEFT JOIN current_user_votes cuv ON cuv."songId" = s.id' : ''}
    ${hasSchedule ? 'LEFT JOIN published_schedule ps ON ps."songId" = s.id' : ''}
    ${userReplayParam ? 'LEFT JOIN current_user_replay cur ON cur.song_id = s.id' : ''}
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY ${orderTerms.join(', ')}
    ${paginationSql}
  `, params)
  const hideStudentInfo = true
  const songs = rows.map((row: any) => ({
    id: Number(row.id), title: row.title, artist: row.artist,
    requester: formatDisambiguatedName({ name: row.requesterName, grade: row.requesterGrade, class: row.requesterClass }),
    requesterId: row.requesterId ? Number(row.requesterId) : undefined,
    requesterGrade: row.requesterGrade || null, requesterClass: row.requesterClass || null,
    collaborators: [], voteCount: Number(row.voteCount || 0), played: row.played === true, playedAt: row.playedAt || null,
    semester: row.semester || null, createdAt: row.createdAt, updatedAt: row.updatedAt,
    requestedAt: formatDateTime(row.createdAt), scheduled: row.scheduled === true,
    cover: row.cover || null, musicPlatform: row.musicPlatform || null, musicId: row.musicId || null,
    cardCodeId: null,
    durationSeconds: null, playUrl: null,
    replayRequested: row.replayRequested === true, replayRequestCount: row.replayRequested === true ? 1 : 0,
    isReplay: row.replayRequested === true, replayRequesters: [],
    hasSubmissionNote: false, submissionNote: null, submissionNotePublic: false,
    submissionAnonymous: row.submissionAnonymous === true,
    preferredPlayTimeId: null,
    preferredPlayDate: null,
    ...(user
      ? {
          voted: row.voted === true,
          replayRequestStatus: row.replayRequestStatus || undefined
        }
      : {})
  })) as SongResponse[]
  if (hideStudentInfo && !isAdmin) maskSongsInfo(songs)
  if (hasSubmissionAnonymous) {
    applySubmissionAnonymity(songs, { id: user?.id ?? null, isAdmin, event: options.event })
  }
  if (!user) songs.forEach(stripAnonymousSongIdentifiers)
  const total = Number(rows[0]?.total || 0)
  let availableSemesters: string[] = []
  if (pageSize > 0) {
    const semesterRows = await client.unsafe(
      `SELECT DISTINCT semester FROM "Song" WHERE semester IS NOT NULL AND semester <> '' ORDER BY semester DESC`
    )
    availableSemesters = semesterRows.map((row: any) => String(row.semester)).filter(Boolean)
  }
  return {
    success: true,
    data: {
      songs,
      total,
      ...(pageSize > 0
        ? {
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
            semesters: availableSemesters
          }
        : {})
    }
  }
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const search = String(query.search || '').trim()
    const semester = String(query.semester || '').trim()
    const grade = String(query.grade || '').trim()
    const scope = String(query.scope || '').trim()
    // 投稿页/相似歌曲检查只需要匹配与状态字段，不拉取完整歌曲详情
    const compact = ['1', 'true'].includes(String(query.compact || '').toLowerCase())
    const sortBy = String(query.sortBy || 'createdAt')
    const sortOrder = String(query.sortOrder || 'desc') === 'asc' ? 'asc' : 'desc'
    // 只有显式传入 pageSize 才分页；未传时保持返回完整列表（后台管理、相似歌曲检查依赖全量数据）
    const requestedPageSize = parseInt(String(query.pageSize || ''), 10)
    const pageSize =
      Number.isFinite(requestedPageSize) && requestedPageSize > 0
        ? Math.min(requestedPageSize, 100)
        : 0
    const paginated = pageSize > 0
    const requestedPage = parseInt(String(query.page || ''), 10)
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
    const user = event.context.user || null
    const isAdmin = Boolean(user && ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role))

    const params: any[] = [user?.id ?? null]
    const addParam = (value: any) => {
      params.push(value)
      return `$${params.length}`
    }

    // 条件同时用于分页计数查询，统一通过 bind 生成占位符
    const buildConditions = (bind: (value: any) => string) => {
      const list: string[] = []
      if (search) {
        const searchParam = bind(`%${search}%`)
        // 匿名投稿不能按真实姓名命中，仅管理员与投稿人本人可按姓名检索
        const requesterNameMatch = isAdmin
          ? `u.name ILIKE ${searchParam}`
          : `((s."submissionAnonymous" = false OR s."requesterId" = ${bind(
              user?.id ?? null
            )}) AND u.name ILIKE ${searchParam})`
        list.push(
          `(s.title ILIKE ${searchParam} OR s.artist ILIKE ${searchParam} OR ${requesterNameMatch})`
        )
      }
      if (semester) list.push(`s.semester = ${bind(semester)}`)
      if (grade) {
        list.push(`u.grade = ${bind(grade)}`)
        // 非管理员按年级筛选时排除匿名投稿，避免借筛选结果反推投稿人年级
        if (!isAdmin) {
          list.push(`(s."submissionAnonymous" = false OR s."requesterId" = ${bind(user?.id ?? null)})`)
        }
      }
      if (scope === 'mine' && user) list.push(`s."requesterId" = ${bind(user.id)}`)
      // 我的重播申请：与列表 replayRequested 字段同口径，当前用户提交过申请即命中
      if (scope === 'replays' && user) {
        list.push(
          `EXISTS (SELECT 1 FROM song_replay_requests rrp WHERE rrp.song_id = s.id AND rrp.user_id = ${bind(user.id)})`
        )
      }
      return list
    }
    const conditions = buildConditions(addParam)

    const orderColumn =
      sortBy === 'title'
        ? 's.title'
        : sortBy === 'artist'
          ? 's.artist'
          : sortBy === 'votes'
            ? '\"voteCount\"'
            : 's.\"createdAt\"'
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    // 分页时与前端展示顺序保持一致：未排期 → 已排期 → 已播放，组内再按指定字段排序
    const orderTerms: string[] = []
    if (paginated) {
      orderTerms.push(
        `CASE WHEN s.played THEN 2 WHEN ps."songId" IS NOT NULL THEN 1 ELSE 0 END ASC`
      )
    }
    orderTerms.push(`${orderColumn} ${sortOrder}`)
    if (sortBy === 'votes') orderTerms.push(`s."createdAt" ASC`)
    if (paginated) orderTerms.push('s.id ASC')
    const orderSql = orderTerms.join(', ')
    const paginationSql = paginated
      ? `LIMIT ${addParam(pageSize)} OFFSET ${addParam((page - 1) * pageSize)}`
      : ''

    if (compact) {
      const compactQuery = `
        WITH
        vote_counts AS (
          SELECT "songId", COUNT(*)::int AS vote_count
          FROM "Vote"
          GROUP BY "songId"
        ),
        current_user_votes AS (
          SELECT "songId"
          FROM "Vote"
          WHERE $1::int IS NOT NULL AND "userId" = $1
          GROUP BY "songId"
        ),
        published_schedule AS (
          SELECT DISTINCT ON ("songId") "songId"
          FROM "Schedule"
          WHERE "isDraft" = false
          ORDER BY "songId", "playDate" DESC
        ),
        current_user_replay AS (
          SELECT DISTINCT ON (song_id) song_id, status
          FROM song_replay_requests
          WHERE $1::int IS NOT NULL AND user_id = $1
          ORDER BY song_id, created_at DESC
        )
        SELECT
          s.id, s.title, s.artist, s.played, s.semester, s."createdAt",
          s."musicPlatform", s."musicId", s."submissionAnonymous",
          u.id AS "requesterId", u.name AS "requesterName",
          u.grade AS "requesterGrade", u.class AS "requesterClass",
          COALESCE(vc.vote_count, 0) AS "voteCount",
          (cuv."songId" IS NOT NULL) AS voted,
          (ps."songId" IS NOT NULL) AS scheduled,
          (cur.song_id IS NOT NULL) AS "replayRequested",
          cur.status AS "replayRequestStatus",
          COALESCE(
            (SELECT "hideStudentInfo" FROM "SystemSettings" LIMIT 1),
            true
          ) AS "hideStudentInfo",
          COUNT(*) OVER()::int AS total
        FROM "Song" s
        LEFT JOIN "User" u ON u.id = s."requesterId"
        LEFT JOIN vote_counts vc ON vc."songId" = s.id
        LEFT JOIN current_user_votes cuv ON cuv."songId" = s.id
        LEFT JOIN published_schedule ps ON ps."songId" = s.id
        LEFT JOIN current_user_replay cur ON cur.song_id = s.id
        ${whereSql}
        ORDER BY ${orderSql}
        ${paginationSql}
      `
      const compactRows = await client.unsafe(compactQuery, params)
      const compactSongs = compactRows.map((row: any) => ({
        id: Number(row.id),
        title: row.title,
        artist: row.artist,
        requester: row.requesterName || '',
        requesterId: row.requesterId ? Number(row.requesterId) : undefined,
        requesterGrade: row.requesterGrade || null,
        requesterClass: row.requesterClass || null,
        collaborators: [],
        voteCount: Number(row.voteCount || 0),
        played: row.played === true,
        playedAt: null,
        semester: row.semester || null,
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
        requestedAt: formatDateTime(row.createdAt),
        scheduled: row.scheduled === true,
        cover: null,
        musicPlatform: row.musicPlatform || null,
        musicId: row.musicId || null,
        cardCodeId: null,
        durationSeconds: null,
        playUrl: null,
        replayRequested: row.replayRequested === true,
        replayRequestCount: row.replayRequested === true ? 1 : 0,
        isReplay: row.replayRequested === true,
        replayRequesters: [],
        hasSubmissionNote: false,
        submissionNote: null,
        submissionNotePublic: false,
        submissionAnonymous: row.submissionAnonymous === true,
        submissionNotePublicStatus: null,
        replayRequestId: null,
        preferredPlayTimeId: null,
        preferredPlayDate: null,
        ...(user
          ? {
              voted: row.voted === true,
              replayRequestStatus: row.replayRequestStatus || undefined
            }
          : {})
      })) as SongResponse[]

      const hideStudentInfo = compactRows[0]?.hideStudentInfo ?? true
      if (hideStudentInfo && !isAdmin) maskSongsInfo(compactSongs)
      applySubmissionAnonymity(compactSongs, { id: user?.id ?? null, isAdmin, event })
      if (!user) compactSongs.forEach(stripAnonymousSongIdentifiers)

      return {
        success: true,
        data: {
          songs: compactSongs,
          total: compactRows.length > 0 ? Number(compactRows[0]?.total || 0) : 0
        }
      }
    }

    // 备选池状态只供管理员使用，非管理员不查询也不下发
    const poolCte = isAdmin ? `song_pool AS (SELECT DISTINCT "songId" FROM "ScheduleSongPool"),` : ''
    const poolSelect = isAdmin ? '(sp."songId" IS NOT NULL) AS "inPool",' : ''
    const poolJoin = isAdmin ? 'LEFT JOIN song_pool sp ON sp."songId" = s.id' : ''

    const baseQuery = `
      WITH
      ${NAME_DISAMBIGUATION_CTES},
      ${poolCte}
      vote_counts AS (
        SELECT "songId", COUNT(*)::int AS vote_count
        FROM "Vote"
        GROUP BY "songId"
      ),
      current_user_votes AS (
        SELECT "songId"
        FROM "Vote"
        WHERE $1::int IS NOT NULL AND "userId" = $1
        GROUP BY "songId"
      ),
      published_schedule AS (
        SELECT DISTINCT ON ("songId") "songId", "playDate", played
        FROM "Schedule"
        WHERE "isDraft" = false
        ORDER BY "songId", "playDate" DESC
      ),
      replay_counts AS (
        SELECT song_id, COUNT(*)::int AS replay_count
        FROM song_replay_requests
        WHERE status = 'PENDING'
        GROUP BY song_id
      ),
      current_user_replay AS (
        SELECT DISTINCT ON (song_id) song_id, status, updated_at
        FROM song_replay_requests
        WHERE $1::int IS NOT NULL AND user_id = $1
        ORDER BY song_id, created_at DESC
      ),
      latest_replay AS (
        SELECT DISTINCT ON (song_id) song_id, id
        FROM song_replay_requests
        WHERE status IN ('PENDING', 'FULFILLED')
        ORDER BY song_id, created_at DESC
      ),
      accepted_collaborators AS (
        SELECT
          sc.song_id,
          jsonb_agg(
            jsonb_build_object(
              'id', u.id,
              'name', u.name,
              'grade', u.grade,
              'class', u.class,
              'nameCount', COALESCE(unc.name_count, 1),
              'gradeCount', COALESCE(ugc.grade_count, 1)
            )
            ORDER BY sc.created_at
          ) AS collaborators
        FROM song_collaborators sc
        INNER JOIN "User" u ON u.id = sc.user_id
        LEFT JOIN user_name_counts unc ON unc.name = u.name
        LEFT JOIN user_grade_counts ugc
          ON ugc.name = u.name AND ugc.grade IS NOT DISTINCT FROM u.grade
        WHERE sc.status = 'ACCEPTED'
        GROUP BY sc.song_id
      ),
      ranked_replay_requesters AS (
        SELECT
          rr.song_id,
          u.id,
          u.name,
          u.grade,
          u.class,
          COALESCE(unc.name_count, 1) AS name_count,
          COALESCE(ugc.grade_count, 1) AS grade_count,
          rr.created_at,
          ROW_NUMBER() OVER (PARTITION BY rr.song_id ORDER BY rr.created_at DESC) AS position
        FROM song_replay_requests rr
        INNER JOIN "User" u ON u.id = rr.user_id
        LEFT JOIN user_name_counts unc ON unc.name = u.name
        LEFT JOIN user_grade_counts ugc
          ON ugc.name = u.name AND ugc.grade IS NOT DISTINCT FROM u.grade
        WHERE rr.status = 'PENDING'
      ),
      replay_requesters AS (
        SELECT
          song_id,
          jsonb_agg(
            jsonb_build_object(
              'id', id,
              'name', name,
              'grade', grade,
              'class', class,
              'nameCount', name_count,
              'gradeCount', grade_count,
              'createdAt', created_at
            )
            ORDER BY created_at DESC
          ) FILTER (WHERE position <= 3) AS requesters
        FROM ranked_replay_requesters
        GROUP BY song_id
      )
      SELECT
        s.id,
        s.title,
        s.artist,
        s.played,
        s."playedAt",
        s.semester,
        s."createdAt",
        s."updatedAt",
        s.cover,
        s."musicPlatform",
        s."musicId",
        s."cardCodeId",
        s."durationSeconds",
        s."playUrl",
        s."submissionNote",
        s."submissionNotePublic",
        s."submissionAnonymous",
        s."submissionNotePublicStatus",
        s."preferredPlayTimeId",
        to_char(s."preferredPlayDate", 'YYYY-MM-DD') AS "preferredPlayDate",
        u.id AS "requesterId",
        u.name AS "requesterName",
        u.grade AS "requesterGrade",
        u.class AS "requesterClass",
        COALESCE(unc.name_count, 1) AS "requesterNameCount",
        COALESCE(ugc.grade_count, 1) AS "requesterGradeCount",
        pt.id AS "playTimeId",
        pt.name AS "playTimeName",
        pt."startTime" AS "playTimeStart",
        pt."endTime" AS "playTimeEnd",
        pt.enabled AS "playTimeEnabled",
        COALESCE(vc.vote_count, 0) AS "voteCount",
        (cuv."songId" IS NOT NULL) AS voted,
        ps."playDate" AS "scheduleDate",
        ps.played AS "schedulePlayed",
        (ps."songId" IS NOT NULL) AS scheduled,
        ${poolSelect}
        COALESCE(rc.replay_count, 0) AS "replayRequestCount",
        cur.status AS "replayRequestStatus",
        cur.updated_at AS "replayRequestUpdatedAt",
        (cur.song_id IS NOT NULL) AS "replayRequested",
        lr.id AS "replayRequestId",
        COALESCE(ac.collaborators, '[]'::jsonb) AS collaborators,
        COALESCE(rr.requesters, '[]'::jsonb) AS "replayRequesters",
        COALESCE(
          (SELECT "hideStudentInfo" FROM "SystemSettings" LIMIT 1),
          true
        ) AS "hideStudentInfo"
        ${paginated ? '' : ', COUNT(*) OVER()::int AS total'}
      FROM "Song" s
      LEFT JOIN "User" u ON u.id = s."requesterId"
      LEFT JOIN user_name_counts unc ON unc.name = u.name
      LEFT JOIN user_grade_counts ugc
        ON ugc.name = u.name AND ugc.grade IS NOT DISTINCT FROM u.grade
      LEFT JOIN "PlayTime" pt ON pt.id = s."preferredPlayTimeId"
      LEFT JOIN vote_counts vc ON vc."songId" = s.id
      LEFT JOIN current_user_votes cuv ON cuv."songId" = s.id
      LEFT JOIN published_schedule ps ON ps."songId" = s.id
      ${poolJoin}
      LEFT JOIN replay_counts rc ON rc.song_id = s.id
      LEFT JOIN current_user_replay cur ON cur.song_id = s.id
      LEFT JOIN latest_replay lr ON lr.song_id = s.id
      LEFT JOIN accepted_collaborators ac ON ac.song_id = s.id
      LEFT JOIN replay_requesters rr ON rr.song_id = s.id
      ${whereSql}
      ORDER BY ${orderSql}
      ${paginationSql}
    `

    const baseRows = await client.unsafe(baseQuery, params)
    const shouldHideStudentInfo = baseRows[0]?.hideStudentInfo ?? true

    let total = baseRows.length > 0 ? Number(baseRows[0]?.total || 0) : 0
    let availableSemesters: string[] = []
    if (paginated) {
      // 空页时窗口计数不可用，计数查询复用同一套筛选条件
      const countParams: any[] = []
      const countConditions = buildConditions((value) => {
        countParams.push(value)
        return `$${countParams.length}`
      })
      const countRows = await client.unsafe(
        `
        SELECT COUNT(*)::int AS total
        FROM "Song" s
        LEFT JOIN "User" u ON u.id = s."requesterId"
        ${countConditions.length > 0 ? `WHERE ${countConditions.join(' AND ')}` : ''}
      `,
        countParams
      )
      total = Number(countRows[0]?.total || 0)

      // 学期选项由服务端下发，避免分页后只统计到当前页的学期
      const semesterRows = await client.unsafe(
        `SELECT DISTINCT semester FROM "Song" WHERE semester IS NOT NULL AND semester <> '' ORDER BY semester DESC`
      )
      availableSemesters = semesterRows.map((row: any) => String(row.semester)).filter(Boolean)
    }

    // 管理员扩展信息：统计每位投稿人的投稿次数与播出次数（按已播出的排期条目计）
    const requesterStatsMap = new Map<number, { submissionCount: number; playCount: number }>()
    if (isAdmin) {
      const requesterIds = [
        ...new Set(
          baseRows
            .map((row: any) => (row.requesterId ? Number(row.requesterId) : null))
            .filter((id): id is number => id !== null)
        )
      ]
      if (requesterIds.length > 0) {
        // 与列表所选学期保持一致：投稿与播出均仅统计该学期内的记录
        const statsParams: any[] = [requesterIds]
        let semesterCondition = ''
        if (semester) {
          statsParams.push(semester)
          semesterCondition = ` AND s.semester = $${statsParams.length}`
        }
        const statsRows = await client.unsafe(
          `
          SELECT
            s."requesterId",
            COUNT(DISTINCT s.id)::int AS "submissionCount",
            COUNT(sch.id)::int AS "playCount"
          FROM "Song" s
          LEFT JOIN "Schedule" sch
            ON sch."songId" = s.id
            AND sch."isDraft" = false
            AND sch.played = true
          WHERE s."requesterId" = ANY($1::int[])${semesterCondition}
          GROUP BY s."requesterId"
        `,
          statsParams
        )
        for (const statsRow of statsRows) {
          requesterStatsMap.set(Number(statsRow.requesterId), {
            submissionCount: Number(statsRow.submissionCount || 0),
            playCount: Number(statsRow.playCount || 0)
          })
        }
      }
    }

    const formattedSongs: SongResponse[] = baseRows.map((row: any) => {
      const collaborators = Array.isArray(row.collaborators)
        ? row.collaborators.map((collaborator: any) => ({
            id: collaborator.id,
            name: collaborator.name,
            displayName: formatDisambiguatedName(
              collaborator,
              Number(collaborator.nameCount),
              Number(collaborator.gradeCount)
            ),
            grade: collaborator.grade,
            class: collaborator.class
          }))
        : []
      const replayRequesters = Array.isArray(row.replayRequesters)
        ? row.replayRequesters.map((requester: any) => ({
            id: requester.id,
            name: requester.name || '未知用户',
            displayName: formatDisambiguatedName(
              requester,
              Number(requester.nameCount),
              Number(requester.gradeCount)
            ),
            grade: requester.grade,
            class: requester.class,
            createdAt: requester.createdAt
          }))
        : []
      const isRequester = Boolean(user && Number(row.requesterId) === user.id)
      // 公开留言审核：待审/已拒绝的不对普通用户公开（管理员与投稿人始终可见完整备注与状态）
      const notePublic = 
        row.submissionNotePublic === true &&
        row.submissionNotePublicStatus !== SUBMISSION_NOTE_STATUS.PENDING &&
        row.submissionNotePublicStatus !== SUBMISSION_NOTE_STATUS.REJECTED
      const canViewSubmissionNote =
        Boolean(row.submissionNote) && (notePublic || Boolean(user && (isAdmin || isRequester)))
      const replayRequestCount = Number(row.replayRequestCount || 0)
      const song: SongResponse = {
        id: Number(row.id),
        title: row.title,
        artist: row.artist,
        requester: formatDisambiguatedName(
          {
            name: row.requesterName,
            grade: row.requesterGrade,
            class: row.requesterClass
          },
          Number(row.requesterNameCount),
          Number(row.requesterGradeCount)
        ),
        requesterId: row.requesterId ? Number(row.requesterId) : undefined,
        requesterGrade: row.requesterGrade || null,
        requesterClass: row.requesterClass || null,
        collaborators,
        voteCount: Number(row.voteCount || 0),
        played: row.played === true,
        playedAt: row.playedAt || null,
        semester: row.semester || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        requestedAt: formatDateTime(row.createdAt),
        scheduled: row.scheduled === true,
        ...(isAdmin ? { inPool: row.inPool === true } : {}),
        cover: row.cover || null,
        musicPlatform: row.musicPlatform || null,
        musicId: row.musicId || null,
        cardCodeId: row.cardCodeId ? Number(row.cardCodeId) : null,
        durationSeconds: row.durationSeconds ? Number(row.durationSeconds) : null,
        playUrl: row.playUrl || null,
        replayRequested: user ? row.replayRequested === true : false,
        replayRequestCount,
        isReplay: replayRequestCount > 0,
        replayRequesters,
        hasSubmissionNote: canViewSubmissionNote,
        submissionNote: canViewSubmissionNote ? row.submissionNote : null,
        submissionNotePublic: canViewSubmissionNote ? row.submissionNotePublic === true : false,
        submissionAnonymous: row.submissionAnonymous === true,
        submissionNotePublicStatus: canViewSubmissionNote ? (row.submissionNotePublicStatus || null) : null,
        replayRequestId: row.replayRequestId ? Number(row.replayRequestId) : null,
        preferredPlayTimeId: row.preferredPlayTimeId ? Number(row.preferredPlayTimeId) : null,
        preferredPlayDate: row.preferredPlayDate || null,
        ...(isAdmin && row.requesterId && requesterStatsMap.has(Number(row.requesterId))
          ? {
              submissionCount: requesterStatsMap.get(Number(row.requesterId))!.submissionCount,
              playCount: requesterStatsMap.get(Number(row.requesterId))!.playCount
            }
          : {})
      }

      if (user) {
        song.voted = row.voted === true
        song.replayRequestStatus = row.replayRequestStatus || undefined
        song.replayRequestUpdatedAt = row.replayRequestUpdatedAt || undefined
        song.replayRequestCooldownRemaining = calculateReplayCooldown(
          row.replayRequestStatus,
          row.replayRequestUpdatedAt
        )
      }

      if (row.scheduleDate) {
        song.scheduleDate = formatDateTime(row.scheduleDate)
        song.schedulePlayed = row.schedulePlayed === true
      }

      if (row.playTimeId) {
        song.preferredPlayTime = {
          id: Number(row.playTimeId),
          name: row.playTimeName,
          startTime: row.playTimeStart,
          endTime: row.playTimeEnd,
          enabled: row.playTimeEnabled === true
        }
      }

      return song
    })

    if (shouldHideStudentInfo && !isAdmin) {
      maskSongsInfo(formattedSongs)
    }
    // 逐条匿名：与「隐藏学生信息」开关相互独立，管理员与投稿人本人不受影响
    applySubmissionAnonymity(formattedSongs, { id: user?.id ?? null, isAdmin, event })
    if (!user) {
      formattedSongs.forEach(stripAnonymousSongIdentifiers)
    }

    return {
      success: true,
      data: {
        songs: formattedSongs,
        total,
        ...(paginated
          ? {
              page,
              pageSize,
              totalPages: Math.max(1, Math.ceil(total / pageSize)),
              semesters: availableSemesters
            }
          : {})
      }
    }
  } catch (error: any) {
    console.error('[Songs API] 获取歌曲列表失败:', error)
    if (error.statusCode) throw error

    if (isSchemaCompatibilityError(error)) {
      try {
        const fallbackQuery = getQuery(event)
        const fallbackSearch = String(fallbackQuery.search || '').trim()
        const fallbackSemester = String(fallbackQuery.semester || '').trim()
        const fallbackGrade = String(fallbackQuery.grade || '').trim()
        const fallbackScope = String(fallbackQuery.scope || '').trim()
        const fallbackSortBy = String(fallbackQuery.sortBy || 'createdAt')
        const fallbackSortOrder = String(fallbackQuery.sortOrder || 'desc')
        const fallbackPageSize = Math.min(
          Math.max(parseInt(String(fallbackQuery.pageSize || ''), 10) || 0, 0),
          100
        )
        const fallbackPage = Math.max(parseInt(String(fallbackQuery.page || ''), 10) || 1, 1)
        const fallbackUser = event.context.user || null
        const fallbackIsAdmin = Boolean(fallbackUser && ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(fallbackUser.role))
        return await loadBasicSongs(client, fallbackSemester, fallbackGrade, fallbackSearch, fallbackUser, fallbackIsAdmin, {
          scope: fallbackScope,
          sortBy: fallbackSortBy,
          sortOrder: fallbackSortOrder,
          page: fallbackPage,
          pageSize: fallbackPageSize,
          event
        })
      } catch (fallbackError) {
        console.error('[Songs API] 基础歌曲查询也失败:', fallbackError)
      }
    }

    const isDbError = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'].some((code) =>
      String(error?.code || error?.message || '').includes(code)
    )
    throw createError({
      statusCode: isDbError ? 503 : 500,
      message: isDbError ? '数据库连接暂时不可用，请稍后重试' : '获取歌曲列表失败，请稍后重试'
    })
  }
})
