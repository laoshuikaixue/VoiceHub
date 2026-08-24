import { createError, defineEventHandler, getQuery } from 'h3'
import { client } from '~/drizzle/db'
import { formatDateTime, getBeijingTimeISOString } from '~/utils/timeUtils'
import {
  maskPublicScheduleData,
  stripAnonymousSongIdentifiersFromSchedules,
  type PublicScheduleItem
} from '../../utils/studentMask'
import { verifyUserAuth } from '../../utils/auth'

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

const isSchemaCompatibilityError = (error: unknown) => {
  const value = error as { code?: string; cause?: { code?: string } } | null
  const code = String(value?.code || value?.cause?.code || '')
  return ['42P01', '42703'].includes(code)
}

// 可选迁移尚未完成时，只依赖初始表结构返回基础排期，避免首页整体不可用。
const loadBasicSchedules = async (client: any, semester: string, user: any, isAdmin: boolean) => {
  const params: any[] = []
  const conditions: string[] = []
  const scheduleDraftColumn = await client.unsafe(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Schedule'
      AND column_name = 'isDraft'
    LIMIT 1
  `)
  if (scheduleDraftColumn.length > 0) conditions.push('sch."isDraft" = false')
  if (semester) conditions.push('s.semester = $1')
  if (semester) params.push(semester)
  const rows = await client.unsafe(`
    SELECT
      sch.id,
      to_char(sch."playDate", 'YYYY-MM-DD') AS "playDate",
      sch.sequence,
      sch.played AS "schedulePlayed",
      sch."playTimeId",
      s.id AS "songId",
      s.title,
      s.artist,
      s.played AS "songPlayed",
      s.cover,
      s."musicPlatform",
      s."musicId",
      s.semester,
      s."requesterId",
      s."createdAt",
      u.name AS "requesterName",
      u.grade AS "requesterGrade",
      u.class AS "requesterClass",
      pt.id AS "playTimeRecordId",
      pt.name AS "playTimeName",
      pt."startTime" AS "playTimeStart",
      pt."endTime" AS "playTimeEnd",
      pt.enabled AS "playTimeEnabled",
      COALESCE((SELECT "hideStudentInfo" FROM "SystemSettings" LIMIT 1), true) AS "hideStudentInfo"
    FROM "Schedule" sch
    INNER JOIN "Song" s ON s.id = sch."songId"
    LEFT JOIN "User" u ON u.id = s."requesterId"
    LEFT JOIN "PlayTime" pt ON pt.id = sch."playTimeId"
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY sch."playDate", sch.sequence
  `, params)
  const hideStudentInfo = rows[0]?.hideStudentInfo ?? true
  const schedules = rows.map((row: any) => ({
    id: Number(row.id),
    playDate: row.playDate,
    sequence: Number(row.sequence || 1),
    replayRequestId: null,
    played: row.schedulePlayed === true,
    playTimeId: row.playTimeId ? Number(row.playTimeId) : null,
    playTime: row.playTimeRecordId ? {
      id: Number(row.playTimeRecordId),
      name: row.playTimeName,
      startTime: row.playTimeStart,
      endTime: row.playTimeEnd,
      enabled: row.playTimeEnabled === true
    } : null,
    song: {
      id: Number(row.songId),
      title: row.title,
      artist: row.artist,
      requester: formatDisplayName({ name: row.requesterName, grade: row.requesterGrade, class: row.requesterClass }),
      requesterGrade: row.requesterGrade || null,
      requesterClass: row.requesterClass || null,
      collaborators: [],
      voteCount: 0,
      played: row.songPlayed === true,
      cover: row.cover || null,
      cardCodeId: null,
      usedCardCode: false,
      musicPlatform: row.musicPlatform || null,
      musicId: row.musicId || null,
      durationSeconds: null,
      playUrl: null,
      semester: row.semester || null,
      requestedAt: row.createdAt ? formatDateTime(row.createdAt) : null,
      hasSubmissionNote: false,
      submissionNote: null,
      submissionNotePublic: false,
      preferredPlayTimeId: null,
      requesterId: row.requesterId ? Number(row.requesterId) : null,
      replayRequestCount: 0,
      replayRequesters: [],
      isReplay: false
    }
  })) as PublicScheduleItem[]
  if (hideStudentInfo && !isAdmin) maskPublicScheduleData(schedules)
  if (!user) stripAnonymousSongIdentifiersFromSchedules(schedules)
  return schedules
}

export default defineEventHandler(async (event) => {
  let authenticatedUser: any = null
  let authenticatedIsAdmin = false
  try {
    const query = getQuery(event)
    const semester = String(query.semester || '').trim()

    const authResult = event.context.authRejected
      ? { success: false, user: null }
      : await verifyUserAuth(event)
    const user = authResult.success ? authResult.user : null
    const isAdmin = Boolean(user && ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role))
    authenticatedUser = user
    authenticatedIsAdmin = isAdmin

    const params: any[] = []
    const semesterCondition = semester ? 'AND s.semester = $1' : ''
    if (semester) params.push(semester)

    // 排期按 YYYY-MM-DD 存储，范围必须按北京时间自然日计算，不能使用当前时刻加减 24 小时。
    const scheduleRangeResult = await client.unsafe(
      `SELECT "scheduleDaysBeforeEnabled", "scheduleDaysBefore", "scheduleDaysAfterEnabled", "scheduleDaysAfter" FROM "SystemSettings" LIMIT 1`
    )
    const storedDaysBefore = Number(scheduleRangeResult[0]?.scheduleDaysBefore)
    const storedDaysAfter = Number(scheduleRangeResult[0]?.scheduleDaysAfter)
    // 兼容历史脏数据，异常值不能导致范围意外扩大或生成无效日期。
    const daysBefore = Number.isInteger(storedDaysBefore) && storedDaysBefore >= 1 && storedDaysBefore <= 730 ? storedDaysBefore : 1
    const daysAfter = Number.isInteger(storedDaysAfter) && storedDaysAfter >= 1 && storedDaysAfter <= 730 ? storedDaysAfter : 1
    const beforeEnabled = scheduleRangeResult[0]?.scheduleDaysBeforeEnabled === true
    const afterEnabled = scheduleRangeResult[0]?.scheduleDaysAfterEnabled === true
    let dateRangeCondition = ''
    if (!isAdmin && (beforeEnabled || afterEnabled)) {
      const today = new Date(`${getBeijingTimeISOString().slice(0, 10)}T00:00:00.000Z`)
      if (beforeEnabled) {
        const minDate = new Date(today.getTime() - daysBefore * 86400000).toISOString()
        dateRangeCondition += ' AND sch."playDate" >= $' + (params.length + 1)
        params.push(minDate)
      }
      if (afterEnabled) {
        const maxDate = new Date(today.getTime() + (daysAfter + 1) * 86400000).toISOString()
        dateRangeCondition += ' AND sch."playDate" < $' + (params.length + 1)
        params.push(maxDate)
      }
    }

    const schedulesQuery = `
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
      replay_counts AS (
        SELECT song_id, COUNT(DISTINCT user_id)::int AS replay_count
        FROM song_replay_requests
        WHERE status IN ('PENDING', 'FULFILLED')
        GROUP BY song_id
      ),
      replay_metadata AS (
        SELECT
          rr.id,
          rr.user_id,
          rr.submission_note,
          rr.submission_note_public,
          rr.preferred_play_time_id
        FROM song_replay_requests rr
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
          rr.status,
          rr.created_at,
          ROW_NUMBER() OVER (PARTITION BY rr.song_id ORDER BY rr.created_at DESC) AS position
        FROM (
          -- insert-only 模型下同一用户可能有多条申请，每人只取最新一条
          SELECT DISTINCT ON (song_id, user_id) song_id, user_id, status, created_at
          FROM song_replay_requests
          WHERE status IN ('PENDING', 'FULFILLED')
          ORDER BY song_id, user_id, created_at DESC
        ) rr
        INNER JOIN "User" u ON u.id = rr.user_id
        LEFT JOIN user_name_counts unc ON unc.name = u.name
        LEFT JOIN user_grade_counts ugc
          ON ugc.name = u.name AND ugc.grade IS NOT DISTINCT FROM u.grade
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
              'status', status,
              'createdAt', created_at
            )
            ORDER BY created_at DESC
          ) FILTER (WHERE position <= 5) AS requesters
        FROM ranked_replay_requesters
        GROUP BY song_id
      )
      SELECT
        sch.id,
        to_char(sch."playDate", 'YYYY-MM-DD') AS "playDate",
        sch.sequence,
        sch.replay_request_id AS "replayRequestId",
        sch.played AS "schedulePlayed",
        sch."playTimeId",
        s.id AS "songId",
        s.title,
        s.artist,
        s.played AS "songPlayed",
        s.cover,
        s."musicPlatform",
        s."musicId",
        s."durationSeconds",
        s."playUrl",
        s.semester,
        s."requesterId",
        s."cardCodeId" IS NOT NULL AS "usedCardCode",
        s."createdAt",
        s."submissionNote",
        s."submissionNotePublic",
        CASE WHEN rm.id IS NOT NULL THEN rm.submission_note ELSE s."submissionNote" END AS "effectiveSubmissionNote",
        CASE WHEN rm.id IS NOT NULL THEN COALESCE(rm.submission_note_public, false) ELSE s."submissionNotePublic" END AS "effectiveSubmissionNotePublic",
        CASE WHEN rm.id IS NOT NULL THEN rm.preferred_play_time_id ELSE s."preferredPlayTimeId" END AS "effectivePlayTimeId",
        rm.user_id AS "replayRequesterUserId",
        u.name AS "requesterName",
        u.grade AS "requesterGrade",
        u.class AS "requesterClass",
        COALESCE(unc.name_count, 1) AS "requesterNameCount",
        COALESCE(ugc.grade_count, 1) AS "requesterGradeCount",
        pt.id AS "playTimeRecordId",
        pt.name AS "playTimeName",
        pt."startTime" AS "playTimeStart",
        pt."endTime" AS "playTimeEnd",
        pt.enabled AS "playTimeEnabled",
        COALESCE(vc.vote_count, 0) AS "voteCount",
        COALESCE(ac.collaborators, '[]'::jsonb) AS collaborators,
        COALESCE(rc.replay_count, 0) AS "replayRequestCount",
        COALESCE(rr.requesters, '[]'::jsonb) AS "replayRequesters",
        COALESCE(
          (SELECT "hideStudentInfo" FROM "SystemSettings" LIMIT 1),
          true
        ) AS "hideStudentInfo"
      FROM "Schedule" sch
      INNER JOIN "Song" s ON s.id = sch."songId"
      LEFT JOIN "User" u ON u.id = s."requesterId"
      LEFT JOIN user_name_counts unc ON unc.name = u.name
      LEFT JOIN user_grade_counts ugc
        ON ugc.name = u.name AND ugc.grade IS NOT DISTINCT FROM u.grade
      LEFT JOIN "PlayTime" pt ON pt.id = sch."playTimeId"
      LEFT JOIN vote_counts vc ON vc."songId" = s.id
      LEFT JOIN accepted_collaborators ac ON ac.song_id = s.id
      LEFT JOIN replay_counts rc ON rc.song_id = s.id
      LEFT JOIN replay_requesters rr ON rr.song_id = s.id
      LEFT JOIN replay_metadata rm ON rm.id = sch.replay_request_id
      WHERE sch."isDraft" = false
      ${semesterCondition}
      ${dateRangeCondition}
      ORDER BY sch."playDate", sch.sequence
    `

    const rows = await client.unsafe(schedulesQuery, params)
    const shouldHideStudentInfo = rows[0]?.hideStudentInfo ?? true

    const formattedSchedules = rows.map((row: any) => {
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
            status: requester.status
          }))
        : []

      const linkedReplayRequestId = row.replayRequestId ? Number(row.replayRequestId) : null
      const effectiveSubmissionNote = row.effectiveSubmissionNote
      const effectiveSubmissionNotePublic = row.effectiveSubmissionNotePublic === true
      const effectivePlayTimeId = row.effectivePlayTimeId ? Number(row.effectivePlayTimeId) : null
      // 备注可见性主体：绑定重播申请时为申请人，否则为歌曲投稿人
      const noteOwnerId =
        linkedReplayRequestId !== null && row.replayRequesterUserId
          ? Number(row.replayRequesterUserId)
          : row.requesterId
            ? Number(row.requesterId)
            : null
      const isNoteOwner = Boolean(user && noteOwnerId !== null && noteOwnerId === user.id)
      const canViewSubmissionNote =
        Boolean(effectiveSubmissionNote) &&
        (effectiveSubmissionNotePublic === true || Boolean(user && (isAdmin || isNoteOwner)))
      const replayRequestCount = Number(row.replayRequestCount || 0)

      return {
        id: Number(row.id),
        // playDate 已在 SQL 层用 to_char 格式化为 YYYY-MM-DD，避免时区解析偏移
        playDate: row.playDate,
        sequence: Number(row.sequence || 1),
        replayRequestId: linkedReplayRequestId,
        played: row.schedulePlayed === true,
        playTimeId: row.playTimeId ? Number(row.playTimeId) : null,
        playTime: row.playTimeRecordId
          ? {
              id: Number(row.playTimeRecordId),
              name: row.playTimeName,
              startTime: row.playTimeStart,
              endTime: row.playTimeEnd,
              enabled: row.playTimeEnabled === true
            }
          : null,
        song: {
          id: Number(row.songId),
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
          requesterGrade: row.requesterGrade || null,
          requesterClass: row.requesterClass || null,
          collaborators,
          voteCount: Number(row.voteCount || 0),
          played: row.songPlayed === true,
          cover: row.cover || null,
          cardCodeId: null,
          usedCardCode: row.usedCardCode === true,
          musicPlatform: row.musicPlatform || null,
          musicId: row.musicId || null,
          durationSeconds: row.durationSeconds || null,
          playUrl: row.playUrl || null,
          semester: row.semester || null,
          requestedAt: row.createdAt ? formatDateTime(row.createdAt) : null,
          hasSubmissionNote: canViewSubmissionNote,
          submissionNote: canViewSubmissionNote ? effectiveSubmissionNote : null,
          submissionNotePublic: canViewSubmissionNote ? effectiveSubmissionNotePublic : false,
          preferredPlayTimeId: effectivePlayTimeId,
          requesterId: row.requesterId ? Number(row.requesterId) : null,
          replayRequestCount,
          replayRequesters,
          isReplay: linkedReplayRequestId !== null
        }
      }
    }) as PublicScheduleItem[]

    if (shouldHideStudentInfo && !isAdmin) {
      maskPublicScheduleData(formattedSchedules)
    }
    if (!user) {
      stripAnonymousSongIdentifiersFromSchedules(formattedSchedules)
    }

    return formattedSchedules
  } catch (error: any) {
    console.error('获取公共排期失败:', error)
    if (error.statusCode) throw error
    if (isSchemaCompatibilityError(error)) {
      try {
        const fallbackSemester = String(getQuery(event).semester || '').trim()
        return await loadBasicSchedules(client, fallbackSemester, authenticatedUser, authenticatedIsAdmin)
      } catch (fallbackError) {
        console.error('基础排期兜底查询失败:', fallbackError)
      }
    }
    throw createError({
      statusCode: 500,
      message: error.message || '获取排期数据失败'
    })
  }
})
