import {
  collaborationLogs,
  db,
  playTimes,
  requestTimes,
  schedules,
  semesters,
  songCollaborators,
  songs,
  users
} from '~/drizzle/db'
import { and, eq, gte, gt, inArray, lt, lte, or, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { createApiError } from '#server/utils/apiError'
import { validateSongDurationOnSubmit } from '#server/services/durationValidationService'
import {
  createCollaborationInvitationNotification,
  sendCollaborationInvitationExternalNotification
} from '#server/services/notificationService'
import { createSongQuotaDrizzleAdapter } from '#server/services/songQuotaDrizzleAdapter'
import { executeSongQuotaSubmission } from '#server/services/songQuotaService'
import { getClientIP } from '#server/utils/ip-utils'
import { getBeijingTimeISOString } from '~/utils/timeUtils'
import { getSystemSettingsCached } from '#server/utils/system-settings-helper'
import { getServerDate } from '#server/utils/serverTime'
import { SERVER_ERROR_CODES } from '#server/config/constants'
import { normalizeForMatch } from '#server/utils/song-name-normalize'
import {
  executeIdempotentSongRequest,
  fingerprintSongRequestPayload,
  isSongAdministrator
} from '#server/utils/song-request-policy'
import { z } from 'zod'

type SongRequestUser = {
  id: number
  role: string
}

const SONG_QUOTA_PERIOD_TYPES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const

function resolveSongQuotaPeriodType(value: unknown) {
  return SONG_QUOTA_PERIOD_TYPES.includes(value as (typeof SONG_QUOTA_PERIOD_TYPES)[number])
    ? value as (typeof SONG_QUOTA_PERIOD_TYPES)[number]
    : 'DAILY'
}

const songRequestBodySchema = z.object({
  title: z.string().trim().min(1, '歌曲名称不能为空').max(200, '歌曲名称不能超过200个字符'),
  artist: z.string().trim().min(1, '艺术家不能为空').max(200, '艺术家不能超过200个字符'),
  cover: z.string().trim().max(1000, '封面地址不能超过1000个字符').optional().nullable(),
  musicPlatform: z.string().trim().max(50, '音乐平台标识不能超过50个字符').optional().nullable(),
  musicId: z.string().trim().max(200, '音乐 ID 不能超过200个字符').optional().nullable(),
  bilibiliCid: z.string().trim().max(100, 'Bilibili CID 不能超过100个字符').optional().nullable(),
  bilibiliPage: z.union([z.string(), z.number()]).optional().nullable(),
  playUrl: z.string().trim().max(2000, '播放链接不能超过2000个字符').optional().nullable(),
  durationSeconds: z.number().int().min(0, '时长不能为负数').max(7200, '时长不能超过2小时').optional().nullable(),
  submissionNote: z.string().trim().max(300, '备注留言不能超过300个字符').optional().nullable(),
  submissionNotePublic: z.boolean().optional(),
  preferredPlayTimeId: z.preprocess(
    (value) => value === null || value === undefined || value === '' ? null : Number(value),
    z.number().int().positive('播出时段 ID 无效').nullable()
  ).optional(),
  collaborators: z.array(z.union([z.string(), z.number()])).max(20, '联合投稿人不能超过20个').optional()
}).strict()

export async function requestSongForUser(
  event: any,
  user: SongRequestUser,
  body: any,
  options: { requestId?: string } = {}
) {
  const parsedBody = songRequestBodySchema.safeParse(body || {})
  if (!parsedBody.success) {
    const issues = parsedBody.error.issues || []
    throw createError({
      statusCode: 400,
      message: issues.length
        ? `请求参数验证失败：${issues.map((issue) => issue.message).join(', ')}`
        : '请求参数验证失败'
    })
  }

  const requestBody = parsedBody.data
  const requestId = String(options.requestId || event.context.requestId || '').trim()
  const isBilibili =
    requestBody.musicPlatform === 'bilibili' ||
    String(requestBody.musicId || '').startsWith('BV') ||
    String(requestBody.musicId || '').startsWith('av')
  let finalMusicId = requestBody.musicId ? String(requestBody.musicId) : null
  if (isBilibili) {
    const bvId = finalMusicId?.split(':')[0]
    if (bvId) {
      const musicIdParts = [bvId]
      if (requestBody.bilibiliCid) {
        musicIdParts.push(requestBody.bilibiliCid)
        if (requestBody.bilibiliPage && Number(requestBody.bilibiliPage) > 1) {
          musicIdParts.push(String(requestBody.bilibiliPage))
        }
      }
      finalMusicId = musicIdParts.join(':')
    }
  }
  const collaboratorIds = (requestBody.collaborators || []).map((id: any) => Number(id)) as number[]
  const uniqueCollaboratorIds = [...new Set<number>(collaboratorIds)]
    .filter((id) => !isNaN(id) && id !== user.id)
    .sort((a, b) => a - b)
  const requestFingerprint = fingerprintSongRequestPayload({
    userId: user.id,
    title: requestBody.title,
    artist: requestBody.artist,
    cover: requestBody.cover,
    musicPlatform: isBilibili ? 'bilibili' : requestBody.musicPlatform,
    musicId: finalMusicId,
    playUrl: requestBody.playUrl,
    submissionNote: requestBody.submissionNote,
    submissionNotePublic: requestBody.submissionNotePublic,
    preferredPlayTimeId: requestBody.preferredPlayTimeId,
    collaboratorIds: uniqueCollaboratorIds
  })

  try {
    const existingSong = await findExistingSongRequest(requestId, requestFingerprint)
    if (existingSong) return existingSong

    // 标准化后再比较，避免同一首歌因标点或空格差异绕过重复检查。
    const normalizedTitle = normalizeForMatch(requestBody.title)
    const normalizedArtist = normalizeForMatch(requestBody.artist)

    const currentSemester = await getCurrentSemesterName()

    const systemSettingsData = await getSystemSettingsCached()
    const isAdmin = isSongAdministrator(user.role)

    // 普通用户沿用同一学期内同一首歌只能投稿一次的规则；管理员可按需重复投稿。
    if (isBilibili && requestBody.musicId && !isAdmin) {
      const existingSongs = await db
        .select({
          id: songs.id,
          musicId: songs.musicId,
          played: songs.played
        })
        .from(songs)
        .where(
          and(
            eq(songs.semester, currentSemester),
            eq(songs.musicPlatform, 'bilibili'),
            eq(songs.musicId, finalMusicId)
          )
        )

      if (existingSongs.length > 0) {
        throw createError({
          statusCode: 400,
          message: `《${requestBody.title}》已经在列表中，不能重复投稿`
        })
      }
    } else if (!isAdmin) {
      const allSongs = await db
        .select({
          id: songs.id,
          title: songs.title,
          artist: songs.artist,
          semester: songs.semester,
          played: songs.played
        })
        .from(songs)
        .where(eq(songs.semester, currentSemester))

      const matchingSongs = allSongs.filter((song) => {
        const songTitle = normalizeForMatch(song.title)
        const songArtist = normalizeForMatch(song.artist)
        return songTitle === normalizedTitle && songArtist === normalizedArtist
      })

      if (matchingSongs.length > 0) {
        throw createError({
          statusCode: 400,
          message: `《${requestBody.title}》已经在列表中，不能重复投稿`
        })
      }
    }

    // 重复投稿限制：同一首歌 / 同一歌手在排期后 N 小时内不可再次投稿
    if (systemSettingsData?.enableSubmissionRestriction && !isAdmin) {
      const now = getServerDate()
      const sameSongHours = systemSettingsData.sameSongRestrictionHours ?? null
      const sameArtistHours = systemSettingsData.sameArtistRestrictionHours ?? null
      const scope = systemSettingsData.submissionRestrictionScope ?? 'all'

      if (sameSongHours || sameArtistHours) {
        const maxHours = Math.max(sameSongHours || 0, sameArtistHours || 0)
        const cutoff = new Date(now.getTime() - maxHours * 3600000)

        // 按 scope 构建 where 子句（显式短路，避免依赖 and(undefined) 的版本行为）
        const scopeFilter = scope === 'self' ? eq(songs.requesterId, user.id) : undefined
        const whereClause = and(
          eq(schedules.isDraft, false),
          or(
            and(lte(schedules.playDate, now), gte(schedules.playDate, cutoff)),
            and(
              gt(schedules.playDate, now),
              or(gte(schedules.publishedAt, cutoff), gte(schedules.createdAt, cutoff))
            )
          ),
          ...(scopeFilter ? [scopeFilter] : [])
        )
        const scheduledSongs = await db
          .select({
            sPlayDate: schedules.playDate,
            sCreatedAt: schedules.createdAt,
            sPublishedAt: schedules.publishedAt,
            songTitle: songs.title,
            songArtist: songs.artist,
            songRequesterId: songs.requesterId
          })
          .from(schedules)
          .innerJoin(songs, eq(schedules.songId, songs.id))
          .where(whereClause)

        for (const scheduled of scheduledSongs) {
          const playDate = scheduled.sPlayDate instanceof Date ? scheduled.sPlayDate : new Date(scheduled.sPlayDate)
          const createdAt = scheduled.sCreatedAt instanceof Date ? scheduled.sCreatedAt : new Date(scheduled.sCreatedAt)
          const publishedAt = scheduled.sPublishedAt
            ? (scheduled.sPublishedAt instanceof Date ? scheduled.sPublishedAt : new Date(scheduled.sPublishedAt))
            : null
          // 已播放歌曲：窗口从播放时间起算；未播放歌曲：窗口从排期时间起算
          const windowStart = playDate.getTime() <= now.getTime()
            ? playDate.getTime()
            : (publishedAt || createdAt).getTime()
          const songWindowMs = (windowStart + (sameSongHours || 0) * 3600000) - now.getTime()
          const artistWindowMs = (windowStart + (sameArtistHours || 0) * 3600000) - now.getTime()
          const songWindowActive = (sameSongHours || 0) > 0 && songWindowMs > 0
          const artistWindowActive = (sameArtistHours || 0) > 0 && artistWindowMs > 0

          if (!songWindowActive && !artistWindowActive) continue

          const scheduledTitleNorm = normalizeForMatch(scheduled.songTitle || '')
          const scheduledArtistNorm = normalizeForMatch(scheduled.songArtist || '')

          if (songWindowActive && scheduledTitleNorm === normalizedTitle && scheduledArtistNorm === normalizedArtist) {
            throw createApiError(
              400,
              SERVER_ERROR_CODES.SONG_RESTRICTION_SAME_SONG,
              '同一首歌在排期后一段时间内不能重复投稿',
              { params: [sameSongHours, requestBody.title] }
            )
          }

          if (artistWindowActive && scheduledArtistNorm === normalizedArtist) {
            throw createApiError(
              400,
              SERVER_ERROR_CODES.SONG_RESTRICTION_SAME_ARTIST,
              '同一歌手在排期后一段时间内不能重复投稿',
              { params: [sameArtistHours, scheduled.songArtist] }
            )
          }
        }
      }
    }

    if (systemSettingsData?.forceBlockAllRequests && !isAdmin) {
      throw createError({
        statusCode: 403,
        message: '投稿功能已关闭'
      })
    }

    let hitRequestTime: any = null
    if (systemSettingsData?.enableRequestTimeLimitation && !isAdmin) {
      const currentTime = getBeijingTimeISOString()

      const hitRequestTimeResult = await db
        .select()
        .from(requestTimes)
        .where(
          and(
            lte(requestTimes.startTime, currentTime),
            gt(requestTimes.endTime, currentTime),
            eq(requestTimes.enabled, true)
          )
        )
        .limit(1)

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

    let preferredPlayTime = null
    if (requestBody.preferredPlayTimeId) {
      if (!systemSettingsData?.enablePlayTimeSelection) {
        throw createError({
          statusCode: 400,
          message: '播出时段选择功能未启用'
        })
      }

      const playTimeResult = await db
        .select()
        .from(playTimes)
        .where(and(eq(playTimes.id, requestBody.preferredPlayTimeId), eq(playTimes.enabled, true)))
        .limit(1)
      preferredPlayTime = playTimeResult[0]

      if (!preferredPlayTime) {
        throw createError({
          statusCode: 400,
          message: '选择的播出时段不存在或未启用'
        })
      }
    }

    const rawSubmissionNote = requestBody.submissionNote || ''
    const submissionNote =
      systemSettingsData?.enableSubmissionRemarks && rawSubmissionNote ? rawSubmissionNote : null
    const submissionNotePublic =
      submissionNote !== null ? requestBody.submissionNotePublic !== false : false

    const notificationsToSend: {
      userId: number
      songTitle: string
      inviterName: string
      message: string
    }[] = []
    let inserted = false

    const song = await db.transaction(async (tx) => {
      const newSong = await executeIdempotentSongRequest({
        async lockRequestIdentity(lockedRequestId) {
          const key = `song-request-id:${lockedRequestId}`
          await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`)
        },
        async findSongByRequestId(lockedRequestId) {
          const rows = await tx.select().from(songs).where(eq(songs.requestId, lockedRequestId)).limit(1)
          return rows[0] ?? null
        }
      }, {
        requestId,
        fingerprint: requestFingerprint,
        insertSong: async () => {
          inserted = true
          if (hitRequestTime) {
            const transactionCurrentTime = getBeijingTimeISOString()
            const latestRequestTimeResult = await tx
              .select()
              .from(requestTimes)
              .where(eq(requestTimes.id, hitRequestTime.id))
              .for('update')
              .limit(1)
            const latestRequestTime = latestRequestTimeResult[0]

            if (
              !latestRequestTime ||
              !latestRequestTime.enabled ||
              latestRequestTime.startTime > transactionCurrentTime ||
              latestRequestTime.endTime <= transactionCurrentTime
            ) {
              throw createError({ statusCode: 403, message: '投稿时段已失效' })
            }
            if (
              latestRequestTime.expected > 0 &&
              latestRequestTime.accepted >= latestRequestTime.expected
            ) {
              throw createError({ statusCode: 403, message: '当前时段投稿名额已满' })
            }

            const updateResult = await tx
              .update(requestTimes)
              .set({ accepted: sql`${requestTimes.accepted} + 1` })
              .where(
                and(
                  eq(requestTimes.id, latestRequestTime.id),
                  lte(requestTimes.startTime, transactionCurrentTime),
                  gt(requestTimes.endTime, transactionCurrentTime),
                  eq(requestTimes.enabled, true),
                  latestRequestTime.expected > 0
                    ? lt(requestTimes.accepted, latestRequestTime.expected)
                    : undefined
                )
              )
              .returning()

            if (updateResult.length === 0) {
              throw createError({ statusCode: 403, message: '当前时段投稿名额已满' })
            }
          }

          const quotaSettings = {
            songQuotaEnabled: systemSettingsData?.songQuotaEnabled === true,
            songQuotaPeriodType: resolveSongQuotaPeriodType(systemSettingsData?.songQuotaPeriodType),
            songQuotaPeriodAmount: systemSettingsData?.songQuotaPeriodAmount || 1,
            adminSongQuotaExempt: systemSettingsData?.adminSongQuotaExempt !== false,
            blockOnSongQuotaInsufficient: systemSettingsData?.blockOnSongQuotaInsufficient !== false
          }
          return executeSongQuotaSubmission(createSongQuotaDrizzleAdapter(tx), {
            userId: user.id,
            requestId,
            settings: quotaSettings,
            now: getServerDate(),
            isAdministrator: isAdmin,
            insertSong: async (quotaSnapshot) => {
              const songResult = await tx
                .insert(songs)
                .values({
                  title: requestBody.title,
                  artist: requestBody.artist,
                  requesterId: user.id,
                  requestId,
                  fingerprint: requestFingerprint,
                  preferredPlayTimeId: preferredPlayTime?.id || null,
                  semester: currentSemester,
                  cover: requestBody.cover || null,
                  musicPlatform: isBilibili ? 'bilibili' : requestBody.musicPlatform || null,
                  musicId: finalMusicId,
                  playUrl: requestBody.playUrl || null,
                  durationSeconds: requestBody.durationSeconds || null,
                  submissionNote,
                  submissionNotePublic,
                  hitRequestId: hitRequestTime?.id || null,
                  ...quotaSnapshot
                })
                .returning()
              const insertedSong = songResult[0]
              if (!insertedSong) {
                throw createError({ statusCode: 500, message: '点歌失败，请稍后重试' })
              }
              return insertedSong
            }
          })
        }
      })

      if (inserted && uniqueCollaboratorIds.length > 0) {
        const validUsers = await tx
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, uniqueCollaboratorIds))
        const validUserIds = new Set(validUsers.map((item) => item.id))

        for (const collaboratorId of uniqueCollaboratorIds) {
          if (!validUserIds.has(collaboratorId)) continue
          const collabResult = await tx
            .insert(songCollaborators)
            .values({ songId: newSong.id, userId: collaboratorId, status: 'PENDING' })
            .returning()
          const collab = collabResult[0]
          if (!collab) {
            throw createError({ statusCode: 500, message: '联合投稿邀请创建失败' })
          }
          await tx.insert(collaborationLogs).values({
            collaboratorId: collab.id,
            action: 'INVITE',
            operatorId: user.id,
            ipAddress: getClientIP(event)
          })
          const notification = await createCollaborationInvitationNotification(
            tx,
            user.id,
            collaboratorId,
            newSong.id,
            newSong.title || requestBody.title
          )
          notificationsToSend.push({
            userId: collaboratorId,
            songTitle: newSong.title || requestBody.title,
            inviterName: notification.inviterName,
            message: notification.message
          })
        }
      }

      return newSong
    })

    // 投后立即校验歌曲时长（不阻塞请求响应）
    const submitDuration = song.durationSeconds
    const submitPlatform = song.musicPlatform
    const submitMusicId = song.musicId
    if (submitDuration && submitPlatform && submitMusicId) {
      const durationValidationTask = (async () => {
        try {
          const result = await validateSongDurationOnSubmit(song.id, submitPlatform, submitMusicId, submitDuration)
          if (result === 'clear') {
            await db.update(songs).set({ durationSeconds: null }).where(eq(songs.id, song.id))
          }
        } catch (err) {
          console.error(`[投稿校验] 后台校验 #${song.id} 异常:`, err)
        }
      })()
      if (typeof event.waitUntil === 'function') {
        event.waitUntil(durationValidationTask)
      } else {
        durationValidationTask.catch((err) => console.error(`[投稿校验] 后台任务 #${song.id} 异常:`, err))
      }
    }

    for (const notification of notificationsToSend) {
      try {
        await sendCollaborationInvitationExternalNotification(
          notification.userId,
          notification.songTitle,
          notification.inviterName,
          notification.message
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
}

async function findExistingSongRequest(requestId: string, fingerprint: string) {
  if (!requestId || !fingerprint) {
    throw new Error('点歌请求必须提供 requestId 和完整指纹')
  }
  const rows = await db.select().from(songs).where(eq(songs.requestId, requestId)).limit(1)
  const existing = rows[0]
  if (!existing) return null
  if (existing.fingerprint !== fingerprint) {
    throw createApiError(409, 'SONG_REQUEST_IDEMPOTENCY_CONFLICT', '请求 ID 已用于不同的点歌请求')
  }
  return existing
}

async function getCurrentSemesterName() {
  try {
    const currentSemesterResult = await db
      .select()
      .from(semesters)
      .where(eq(semesters.isActive, true))
      .limit(1)
    const currentSemester = currentSemesterResult[0]

    if (currentSemester) {
      return currentSemester.name
    }

    throw new Error('未设置活跃学期')
  } catch (error) {
    console.error('获取当前学期失败:', error)
    throw error
  }
}
