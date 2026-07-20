import { createError, defineEventHandler, getQuery } from 'h3'
import { client } from '~/drizzle/db'
import { formatDateTime } from '~/utils/timeUtils'
import { maskSongsInfo, type MaskableSong } from '~~/server/utils/studentMask'

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
  scheduleDate?: string
  schedulePlayed?: boolean
  replayRequestStatus?: string
  replayRequestUpdatedAt?: Date | string
  replayRequestCooldownRemaining?: number
  hasSubmissionNote?: boolean
  submissionNote?: string | null
  submissionNotePublic?: boolean
}

const formatDisplayName = (
  user: { name?: string | null; grade?: string | null; class?: string | null },
  nameCount = 1,
  gradeCount = 1
) => {
  if (!user?.name) return '未知用户'
  if (nameCount <= 1 || !user.grade) return user.name
  if (gradeCount > 1 && user.class) return `${user.name}（${user.grade} ${user.class}）`
  return `${user.name}（${user.grade}）`
}

const calculateReplayCooldown = (status?: string | null, updatedAt?: Date | string | null) => {
  if (status !== 'REJECTED' || !updatedAt) return undefined
  const cooldownMs = 24 * 60 * 60 * 1000
  const remainingMs = cooldownMs - (Date.now() - new Date(updatedAt).getTime())
  return remainingMs > 0 ? Math.ceil(remainingMs / (60 * 60 * 1000)) : 0
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const search = String(query.search || '').trim()
    const semester = String(query.semester || '').trim()
    const grade = String(query.grade || '').trim()
    const scope = String(query.scope || '').trim()
    const sortBy = String(query.sortBy || 'createdAt')
    const sortOrder = String(query.sortOrder || 'desc') === 'asc' ? 'asc' : 'desc'
    const user = event.context.user || null
    const isAdmin = Boolean(user && ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role))

    const params: any[] = [user?.id ?? null]
    const conditions: string[] = []
    const addParam = (value: any) => {
      params.push(value)
      return `$${params.length}`
    }

    if (search) {
      const searchParam = addParam(`%${search}%`)
      conditions.push(`(s.title ILIKE ${searchParam} OR s.artist ILIKE ${searchParam})`)
    }
    if (semester) conditions.push(`s.semester = ${addParam(semester)}`)
    if (grade) conditions.push(`u.grade = ${addParam(grade)}`)
    if (scope === 'mine' && user) conditions.push(`s.\"requesterId\" = $1`)

    const orderColumn =
      sortBy === 'title'
        ? 's.title'
        : sortBy === 'artist'
          ? 's.artist'
          : sortBy === 'votes'
            ? '\"voteCount\"'
            : 's.\"createdAt\"'
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const orderSql =
      sortBy === 'votes'
        ? `${orderColumn} ${sortOrder}, s.\"createdAt\" ASC`
        : `${orderColumn} ${sortOrder}`

    const baseQuery = `
      WITH
      user_name_counts AS (
        SELECT name, COUNT(*)::int AS name_count
        FROM "User"
        WHERE name IS NOT NULL
        GROUP BY name
      ),
      user_grade_counts AS (
        SELECT name, grade, COUNT(*)::int AS grade_count
        FROM "User"
        WHERE name IS NOT NULL
        GROUP BY name, grade
      ),
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
        SELECT song_id, status, updated_at
        FROM song_replay_requests
        WHERE $1::int IS NOT NULL AND user_id = $1
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
        s."playUrl",
        s."submissionNote",
        s."submissionNotePublic",
        s."preferredPlayTimeId",
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
        COALESCE(rc.replay_count, 0) AS "replayRequestCount",
        cur.status AS "replayRequestStatus",
        cur.updated_at AS "replayRequestUpdatedAt",
        (cur.song_id IS NOT NULL) AS "replayRequested",
        COALESCE(ac.collaborators, '[]'::jsonb) AS collaborators,
        COALESCE(rr.requesters, '[]'::jsonb) AS "replayRequesters",
        COALESCE(
          (SELECT "hideStudentInfo" FROM "SystemSettings" LIMIT 1),
          true
        ) AS "hideStudentInfo",
        COUNT(*) OVER()::int AS total
      FROM "Song" s
      LEFT JOIN "User" u ON u.id = s."requesterId"
      LEFT JOIN user_name_counts unc ON unc.name = u.name
      LEFT JOIN user_grade_counts ugc
        ON ugc.name = u.name AND ugc.grade IS NOT DISTINCT FROM u.grade
      LEFT JOIN "PlayTime" pt ON pt.id = s."preferredPlayTimeId"
      LEFT JOIN vote_counts vc ON vc."songId" = s.id
      LEFT JOIN current_user_votes cuv ON cuv."songId" = s.id
      LEFT JOIN published_schedule ps ON ps."songId" = s.id
      LEFT JOIN replay_counts rc ON rc.song_id = s.id
      LEFT JOIN current_user_replay cur ON cur.song_id = s.id
      LEFT JOIN accepted_collaborators ac ON ac.song_id = s.id
      LEFT JOIN replay_requesters rr ON rr.song_id = s.id
      ${whereSql}
      ORDER BY ${orderSql}
    `

    const baseRows = await client.unsafe(baseQuery, params)
    const shouldHideStudentInfo = baseRows[0]?.hideStudentInfo ?? true

    const formattedSongs: SongResponse[] = baseRows.map((row: any) => {
      const collaborators = Array.isArray(row.collaborators)
        ? row.collaborators.map((collaborator: any) => ({
            id: collaborator.id,
            name: collaborator.name,
            displayName: formatDisplayName(
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
            displayName: formatDisplayName(
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
      const canViewSubmissionNote =
        Boolean(row.submissionNote) &&
        (row.submissionNotePublic === true || Boolean(user && (isAdmin || isRequester)))
      const replayRequestCount = Number(row.replayRequestCount || 0)
      const song: SongResponse = {
        id: Number(row.id),
        title: row.title,
        artist: row.artist,
        requester: formatDisplayName(
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
        cover: row.cover || null,
        musicPlatform: row.musicPlatform || null,
        musicId: row.musicId || null,
        cardCodeId: row.cardCodeId ? Number(row.cardCodeId) : null,
        playUrl: row.playUrl || null,
        replayRequested: user ? row.replayRequested === true : false,
        replayRequestCount,
        isReplay: replayRequestCount > 0,
        replayRequesters,
        hasSubmissionNote: canViewSubmissionNote,
        submissionNote: canViewSubmissionNote ? row.submissionNote : null,
        submissionNotePublic: canViewSubmissionNote ? row.submissionNotePublic === true : false,
        preferredPlayTimeId: row.preferredPlayTimeId ? Number(row.preferredPlayTimeId) : null
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

    return {
      success: true,
      data: {
        songs: formattedSongs,
        total: baseRows.length > 0 ? Number(baseRows[0]?.total || 0) : 0
      }
    }
  } catch (error: any) {
    console.error('[Songs API] 获取歌曲列表失败:', error)
    if (error.statusCode) throw error

    const isDbError = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'].some((code) =>
      String(error?.code || error?.message || '').includes(code)
    )
    throw createError({
      statusCode: isDbError ? 503 : 500,
      message: isDbError ? '数据库连接暂时不可用，请稍后重试' : '获取歌曲列表失败，请稍后重试'
    })
  }
})
