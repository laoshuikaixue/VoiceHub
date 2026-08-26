import {
  collaborationLogs,
  db,
  playTimes,
  requestTimes,
  schedules,
  semesters,
  cardCodes,
  songCollaborators,
  songs,
  users
} from '~/drizzle/db'
import { and, eq, gte, gt, inArray, lt, lte, or, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { validateSongDurationOnSubmit } from '~~/server/services/durationValidationService'
import { createApiError } from '~~/server/utils/apiError'
import { createCollaborationInvitationNotification } from '~~/server/services/notificationService'
import {
  isCardCodeLimitBypassActive,
  isLimitReached
} from '~~/server/utils/submissionLimit'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getBeijingTimeISOString } from '~/utils/timeUtils'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { getServerDate } from '~~/server/utils/serverTime'
import { SERVER_ERROR_CODES, SUBMISSION_NOTE_STATUS } from '~~/server/config/constants'
import { normalizeForMatch } from '~~/server/utils/song-name-normalize'
import { z } from 'zod'

type SongRequestUser = {
  id: number
  role: string
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
  cardCode: z.string().trim().max(100, 'CARD_CODE_TOO_LONG').optional().nullable(),
  collaborators: z.array(z.union([z.string(), z.number()])).max(20, '联合投稿人不能超过20个').optional()
})

export async function requestSongForUser(event: any, user: SongRequestUser, body: any) {
  const parsedBody = songRequestBodySchema.safeParse(body || {})
  if (!parsedBody.success) {
    const issues = parsedBody.error.issues || []
    const cardCodeIssue = issues.find((issue) => String(issue.message).startsWith('CARD_CODE_'))
    if (cardCodeIssue) {
      throw createApiError(400, cardCodeIssue.message, 'Invalid request card')
    }

    throw createError({
      statusCode: 400,
      message: issues.length
        ? `请求参数验证失败：${issues.map((issue) => issue.message).join(', ')}`
        : '请求参数验证失败'
    })
  }

  const requestBody = parsedBody.data

  try {
    // 标准化后再比较，避免同一首歌因标点或空格差异绕过重复检查。
    const normalizedTitle = normalizeForMatch(requestBody.title)
    const normalizedArtist = normalizeForMatch(requestBody.artist)

    const currentSemester = await getCurrentSemesterName()

    const systemSettingsData = await getSystemSettingsCached()
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'SONG_ADMIN'].includes(user.role)

    const isBilibili =
      requestBody.musicPlatform === 'bilibili' ||
      String(requestBody.musicId || '').startsWith('BV') ||
      String(requestBody.musicId || '').startsWith('av')

    // 普通用户沿用同一学期内同一首歌只能投稿一次的规则；管理员可按需重复投稿。
    if (isBilibili && requestBody.musicId && !isAdmin) {
      let fullMusicId = String(requestBody.musicId)
      const bvId = fullMusicId.split(':')[0]

      if (requestBody.bilibiliCid) {
        const musicIdParts = [bvId, requestBody.bilibiliCid]
        if (requestBody.bilibiliPage && Number(requestBody.bilibiliPage) > 1) {
          musicIdParts.push(String(requestBody.bilibiliPage))
        }
        fullMusicId = musicIdParts.join(':')
      }

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
            eq(songs.musicId, fullMusicId)
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

    let effectiveLimit: number | null = null
    let limitType: 'daily' | 'weekly' | 'monthly' | null = null

    if (systemSettingsData?.enableSubmissionLimit && !isAdmin) {
      const dailyLimit = systemSettingsData.dailySubmissionLimit
      const weeklyLimit = systemSettingsData.weeklySubmissionLimit
      const monthlyLimit = systemSettingsData.monthlySubmissionLimit

      if (dailyLimit !== null && dailyLimit !== undefined) {
        effectiveLimit = dailyLimit
        limitType = 'daily'
      } else if (weeklyLimit !== null && weeklyLimit !== undefined) {
        effectiveLimit = weeklyLimit
        limitType = 'weekly'
      } else if (monthlyLimit !== null && monthlyLimit !== undefined) {
        effectiveLimit = monthlyLimit
        limitType = 'monthly'
      }

      if (effectiveLimit === 0) {
        throw createError({
          statusCode: 403,
          message: '投稿功能已关闭'
        })
      }
    }

    // 强制使用点歌券仅在点歌券功能启用时生效
    if (
      systemSettingsData?.requireCardCodeForRequests &&
      systemSettingsData?.enableCardCodeRequests &&
      !isAdmin
    ) {
      const providedCardCode = requestBody.cardCode ? requestBody.cardCode.trim().toUpperCase() : ''
      if (!providedCardCode) {
        throw createApiError(
          403,
          'CARD_CODE_REQUIRED_FOR_SITE',
          'This site requires a valid request card to submit songs'
        )
      }
    }

    const isCardCodeEnabled = systemSettingsData?.enableCardCodeRequests === true
    const excludeCardCodeRequestsFromLimit = isCardCodeLimitBypassActive(systemSettingsData)
    if (requestBody.cardCode && requestBody.cardCode.trim() && !isCardCodeEnabled && !isAdmin) {
      throw createApiError(400, 'CARD_CODE_DISABLED', 'Request card submissions are not enabled')
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
    // 公开留言审核：开关开启时投稿不立即公开，进入待审后由管理员通过
    const noteRequiresApproval = systemSettingsData?.submissionNoteRequiresApproval === true
    const wantsPublic = submissionNote !== null ? requestBody.submissionNotePublic !== false : false
    const submissionNotePublic = noteRequiresApproval ? false : wantsPublic
    // 仅用户勾选公开的留言进入审核，私密留言只供管理员查看
    const submissionNotePublicStatus =
      noteRequiresApproval && submissionNote !== null && wantsPublic
        ? SUBMISSION_NOTE_STATUS.PENDING
        : null

    const notificationsToSend: { userId: number; songId: number; songTitle: string }[] = []

    const song = await db.transaction(async (tx) => {
      let providedCardCodeId: number | null = null
      const providedCardCode = requestBody.cardCode ? requestBody.cardCode.trim().toUpperCase() : ''

      if (providedCardCode) {
        const codeRows = await tx
          .select()
          .from(cardCodes)
          .where(eq(cardCodes.code, providedCardCode))
          .limit(1)

        const found = codeRows[0]
        if (!found || found.status !== 'AVAILABLE') {
          throw createApiError(
            400,
            'CARD_CODE_INVALID_OR_USED',
            'Request card is invalid or already used'
          )
        }

        const lockResult = await tx
          .update(cardCodes)
          .set({ status: 'LOCKED', lockedBy: user.id, lockedAt: new Date() })
          .where(and(eq(cardCodes.id, found.id), eq(cardCodes.status, 'AVAILABLE')))
          .returning()

        if (lockResult.length === 0) {
          throw createApiError(
            400,
            'CARD_CODE_LOCKED_OR_UNAVAILABLE',
            'Request card is locked or unavailable'
          )
        }

        providedCardCodeId = found.id
      }

      if (
        systemSettingsData?.enableSubmissionLimit &&
        !isAdmin &&
        !(excludeCardCodeRequestsFromLimit && providedCardCodeId) &&
        effectiveLimit &&
        effectiveLimit > 0 &&
        limitType
      ) {
        // 同一用户的限额检查必须串行，否则并发请求可能读取到相同计数并同时越过上限。
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, user.id))
          .for('update')

        if (
          await isLimitReached(tx as any, user.id, limitType, effectiveLimit, {
            excludeCardCodeRequests: excludeCardCodeRequestsFromLimit
          })
        ) {
          const labelMap: Record<string, string> = { daily: '每日', weekly: '每周', monthly: '每月' }
          const timeMap: Record<string, string> = { daily: '今日', weekly: '本周', monthly: '本月' }

          throw createError({
            statusCode: 400,
            message: `${labelMap[limitType]}投稿限额为${effectiveLimit}首，您${timeMap[limitType]}已达到限额`
          })
        }
      }

      if (hitRequestTime) {
        const latestRequestTimeResult = await tx
          .select()
          .from(requestTimes)
          .where(eq(requestTimes.id, hitRequestTime.id))
          .limit(1)
        const latestRequestTime = latestRequestTimeResult[0]

        if (!latestRequestTime || !latestRequestTime.enabled) {
          throw createError({ statusCode: 403, message: '投稿时段已失效' })
        }

        const updateResult = await tx
          .update(requestTimes)
          .set({
            accepted: sql`${requestTimes.accepted} + 1`
          })
          .where(
            and(
              eq(requestTimes.id, hitRequestTime.id),
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

      const songResult = await tx
        .insert(songs)
        .values({
          title: requestBody.title,
          artist: requestBody.artist,
          requesterId: user.id,
          preferredPlayTimeId: preferredPlayTime?.id || null,
          semester: currentSemester,
          cover: requestBody.cover || null,
          musicPlatform: isBilibili ? 'bilibili' : requestBody.musicPlatform || null,
          musicId: finalMusicId,
          cardCodeId: providedCardCodeId || null,
          playUrl: requestBody.playUrl || null,
          durationSeconds: requestBody.durationSeconds || null,
          submissionNote,
          submissionNotePublic,
          submissionNotePublicStatus,
          hitRequestId: hitRequestTime?.id || null
        })
        .returning()
      const newSong = songResult[0]
      if (!newSong) {
        throw createError({ statusCode: 500, message: '点歌失败，请稍后重试' })
      }

      if (
        requestBody.collaborators &&
        Array.isArray(requestBody.collaborators) &&
        requestBody.collaborators.length > 0
      ) {
        const collaboratorIds = requestBody.collaborators.map((id: any) => Number(id)) as number[]
        const uniqueCollaboratorIds = [...new Set<number>(collaboratorIds)].filter(
          (id) => !isNaN(id) && id !== user.id
        )

        if (uniqueCollaboratorIds.length > 0) {
          const validUsers = await tx
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, uniqueCollaboratorIds))

          const validUserIds = new Set(validUsers.map((item) => item.id))

          for (const collaboratorId of uniqueCollaboratorIds) {
            if (!validUserIds.has(collaboratorId)) continue

            try {
              const existingCollab = await tx
                .select()
                .from(songCollaborators)
                .where(
                  and(
                    eq(songCollaborators.songId, newSong.id),
                    eq(songCollaborators.userId, collaboratorId)
                  )
                )
                .limit(1)

              if (existingCollab.length > 0) continue

              const collabResult = await tx
                .insert(songCollaborators)
                .values({
                  songId: newSong.id,
                  userId: collaboratorId,
                  status: 'PENDING'
                })
                .returning()

              const collab = collabResult[0]
              if (!collab) continue

              await tx.insert(collaborationLogs).values({
                collaboratorId: collab.id,
                action: 'INVITE',
                operatorId: user.id,
                ipAddress: getClientIP(event)
              })

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
