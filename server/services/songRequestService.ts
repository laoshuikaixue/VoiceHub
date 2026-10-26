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
import { reconcileSongDurationOnSubmit } from '~~/server/services/durationValidationService'
import { createApiError } from '~~/server/utils/apiError'
import { createCollaborationInvitationNotification } from '~~/server/services/notificationService'
import { enqueueAstrbotGroupEvent } from '~~/server/services/astrbotGroupService'
import {
  findReachedGlobalSubmissionLimit,
  getActiveGlobalSubmissionLimits,
  isCardCodeLimitBypassActive,
  isLimitReached,
  type LimitType
} from '~~/server/utils/submissionLimit'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getBeijingTimeISOString, getWeekdayLabel } from '~/utils/timeUtils'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { getServerDate } from '~~/server/utils/serverTime'
import {
  getWeekdayOfDateString,
  slotAppliesToWeekday,
  validatePlayDateString
} from '~~/server/utils/play-slot'
import { SERVER_ERROR_CODES, SONG_DURATION_MAX_SECONDS, SONG_DURATION_MIN_SECONDS, SUBMISSION_NOTE_MAX_LENGTH, SUBMISSION_NOTE_STATUS } from '~~/server/config/constants'
import { normalizeForMatch } from '~~/server/utils/song-name-normalize'
import { resolveSubmissionRestrictionPolicy } from '~~/server/utils/submission-restriction-policy'
import { z } from 'zod'
import { readSelection } from '~~/server/utils/music-source-plugins/resolver'

type SongRequestUser = {
  id: number
  role: string
}

export type SongRequestOptions = {
  /**
   * 是否按站点设置强制要求选择播出时段。
   * 网页投稿表单为 true；机器人 / 开放 API 等没有时段选择界面的入口传 false，
   * 未提供时段时按「未指定时段」落库。
   */
  enforceRequiredPlaySlot?: boolean
}

const songRequestBodySchema = z.object({
  selectionToken: z.string().max(200000).optional(),
  title: z.string().trim().min(1, '歌曲名称不能为空').max(200, '歌曲名称不能超过200个字符'),
  artist: z.string().trim().min(1, '艺术家不能为空').max(200, '艺术家不能超过200个字符'),
  cover: z
    .string()
    .trim()
    .max(1000, '封面地址不能超过1000个字符')
    // 封面必须是完整 http(s) 链接，防止音源返回 pic_id 等片段被误存导致封面无法显示
    .refine((value) => value === '' || /^https?:\/\//i.test(value), '封面地址必须以 http(s):// 开头')
    .optional()
    .nullable(),
  musicPlatform: z.string().trim().max(50, '音乐平台标识不能超过50个字符').optional().nullable(),
  musicId: z.string().trim().max(200, '音乐 ID 不能超过200个字符').optional().nullable(),
  bilibiliCid: z.string().trim().max(100, 'Bilibili CID 不能超过100个字符').optional().nullable(),
  bilibiliPage: z.union([z.string(), z.number()]).optional().nullable(),
  playUrl: z.string().trim().max(2000, '播放链接不能超过2000个字符').optional().nullable(),
  durationSeconds: z.number().int().min(SONG_DURATION_MIN_SECONDS, '时长不能为负数').max(SONG_DURATION_MAX_SECONDS, '时长不能超过2小时').optional().nullable(),
  // 留言长度上限：与 RequestForm.vue 的 maxlength 同源，导出供机器人端点前置校验，
  // 保持「站点表单 / 机器人 / zod」三处同一个数值
  submissionNote: z.string().trim().max(SUBMISSION_NOTE_MAX_LENGTH, `备注留言不能超过${SUBMISSION_NOTE_MAX_LENGTH}个字符`).optional().nullable(),
  submissionNotePublic: z.boolean().optional(),
  submissionAnonymous: z.boolean().optional(),
  preferredPlayTimeId: z.preprocess(
    (value) => value === null || value === undefined || value === '' ? null : Number(value),
    z.number().int().positive('播出时段 ID 无效').nullable()
  ).optional(),
  // 期望播出日期（北京时间 YYYY-MM-DD），与 preferredPlayTimeId 共同构成「日期 + 时段」
  preferredPlayDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '播出日期格式不正确，应为 YYYY-MM-DD')
    .optional()
    .nullable(),
  cardCode: z.string().trim().max(100, 'CARD_CODE_TOO_LONG').optional().nullable(),
  collaborators: z.array(z.union([z.string(), z.number()])).max(20, '联合投稿人不能超过20个').optional()
})

export async function requestSongForUser(
  event: any,
  user: SongRequestUser,
  body: any,
  options: SongRequestOptions = {}
) {
  const enforceRequiredPlaySlot = options.enforceRequiredPlaySlot !== false
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
  const musicSourceData = requestBody.selectionToken
    ? readSelection(requestBody.selectionToken, user.id, requestBody.musicPlatform || undefined, requestBody.musicId || undefined)
    : null

  try {
    // 标准化后再比较，避免同一首歌因标点或空格差异绕过重复检查。
    const normalizedTitle = normalizeForMatch(requestBody.title)
    const normalizedArtist = normalizeForMatch(requestBody.artist)

    const currentSemester = await getCurrentSemesterName()

    const systemSettingsData = await getSystemSettingsCached()
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'SONG_ADMIN'].includes(user.role)
    const restrictionPolicy = resolveSubmissionRestrictionPolicy(systemSettingsData)
    const semesterRestrictionOn = restrictionPolicy.mode === 'semester' && !isAdmin

    const isBilibili =
      requestBody.musicPlatform === 'bilibili' ||
      String(requestBody.musicId || '').startsWith('BV') ||
      String(requestBody.musicId || '').startsWith('av')

    // 仅在重复投稿限制开启且未配置冷却时长时，沿用同一学期内同一首歌只能投稿一次的规则；管理员始终豁免。
    if (isBilibili && requestBody.musicId && semesterRestrictionOn) {
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
    } else if (semesterRestrictionOn) {
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
    if (restrictionPolicy.mode === 'window' && !isAdmin) {
      const now = getServerDate()
      const { sameSongHours, sameArtistHours, scope } = restrictionPolicy
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

    // 播出日期 + 时段选择（依赖 enablePlayTimeSelection 总开关）
    // 口径：时段是硬约束（开启时段必选后网页投稿必须选择，排期也只能排到该时段）；
    //       播出日期是可选偏好，仅在用户显式选择时落库，未选择保持 null 交由排期决定
    const playTimeSelectionEnabled = systemSettingsData?.enablePlayTimeSelection === true
    const playSlotRequired =
      playTimeSelectionEnabled &&
      systemSettingsData?.playSlotRequired === true &&
      enforceRequiredPlaySlot
    const requestedPlayDate =
      typeof requestBody.preferredPlayDate === 'string' && requestBody.preferredPlayDate
        ? requestBody.preferredPlayDate
        : null
    const hasPlayTime = !!requestBody.preferredPlayTimeId

    let preferredPlayTime = null
    // 仅取用户显式指定的日期，未选择则为 null
    const playDate: string | null = requestedPlayDate

    if (playTimeSelectionEnabled) {
      if (playSlotRequired && !hasPlayTime) {
        throw createApiError(
          400,
          SERVER_ERROR_CODES.SONG_PLAY_SLOT_REQUIRED,
          '请选择期望播出时段'
        )
      }

      if (requestedPlayDate) {
        const dateCheck = validatePlayDateString(requestedPlayDate)
        if (!dateCheck.valid) {
          throw createApiError(
            400,
            dateCheck.code || SERVER_ERROR_CODES.SONG_PLAY_DATE_FORMAT_INVALID,
            '播出日期无效'
          )
        }
      }

      if (hasPlayTime) {
        const playTimeResult = await db
          .select()
          .from(playTimes)
          .where(and(eq(playTimes.id, requestBody.preferredPlayTimeId!), eq(playTimes.enabled, true)))
          .limit(1)
        preferredPlayTime = playTimeResult[0]

        if (!preferredPlayTime) {
          throw createError({
            statusCode: 400,
            message: '选择的播出时段不存在或未启用'
          })
        }

        // 指定的日期不开放该时段则拒绝（弹窗内已按星期过滤，服务端同样校验）
        if (requestedPlayDate) {
          const weekday = getWeekdayOfDateString(requestedPlayDate)
          if (!slotAppliesToWeekday(preferredPlayTime.weekdays, weekday)) {
            const weekdayLabel = getWeekdayLabel(weekday)
            throw createApiError(
              400,
              SERVER_ERROR_CODES.SONG_PLAY_SLOT_NOT_OPEN_ON_DATE,
              `所选播出时段在 ${requestedPlayDate}（${weekdayLabel}）不开放，请重新选择日期或时段`,
              { params: [requestedPlayDate, weekdayLabel] }
            )
          }
        }
      }
    } else if (requestedPlayDate || hasPlayTime) {
      // 功能未开启时忽略任何日期/时段入参，防止绕过开关写入
      throw createError({
        statusCode: 400,
        message: '播出时段选择功能未启用'
      })
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

    // 匿名投稿：站点未开启总开关时强制视为实名（防绕过）；开启时按用户勾选。
    // 匿名投稿不允许联合投稿。
    const submissionAnonymous =
      systemSettingsData?.allowAnonymousSubmission === true &&
      requestBody.submissionAnonymous === true
    if (submissionAnonymous && requestBody.collaborators?.length) {
      throw createApiError(
        400,
        SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
        '匿名投稿不支持联合投稿'
      )
    }

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
        if (!found) {
          throw createApiError(
            400,
            'CARD_CODE_INVALID_OR_USED',
            'Request card is invalid or already used'
          )
        }

        // 派发给指定用户的券只能由该用户核销；未派发的券沿用原有规则
        const isAssignedToSelf = found.status === 'ASSIGNED' && found.assignedTo === user.id
        if (found.status !== 'AVAILABLE' && !isAssignedToSelf) {
          throw createApiError(
            400,
            'CARD_CODE_INVALID_OR_USED',
            'Request card is invalid or already used'
          )
        }

        // 条件更新保证并发下同一张券只会被锁定一次
        const lockResult = await tx
          .update(cardCodes)
          .set({ status: 'LOCKED', lockedBy: user.id, lockedAt: getServerDate(), updatedAt: getServerDate() })
          .where(
            isAssignedToSelf
              ? and(eq(cardCodes.id, found.id), eq(cardCodes.status, 'ASSIGNED'), eq(cardCodes.assignedTo, user.id))
              : and(eq(cardCodes.id, found.id), eq(cardCodes.status, 'AVAILABLE'))
          )
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

      // 全站投稿总量限额：对所有用户合计计数，管理员豁免
      // 先解析生效周期，三值全空（无周期可拦）时跳过，避免零收益的全站串行加锁
      if (!isAdmin && getActiveGlobalSubmissionLimits(systemSettingsData).length > 0) {
        // 全局计数必须串行，否则并发请求会读到相同计数并同时越过上限
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('global_submission_limit'))`)

        const reachedLimit = await findReachedGlobalSubmissionLimit(
          tx as any,
          systemSettingsData
        )

        if (reachedLimit) {
          const codeMap: Record<LimitType, string> = {
            daily: SERVER_ERROR_CODES.SONG_GLOBAL_DAILY_LIMIT_REACHED,
            weekly: SERVER_ERROR_CODES.SONG_GLOBAL_WEEKLY_LIMIT_REACHED,
            monthly: SERVER_ERROR_CODES.SONG_GLOBAL_MONTHLY_LIMIT_REACHED
          }

          throw createApiError(
            403,
            codeMap[reachedLimit.type],
            `全站投稿总量已达上限（${reachedLimit.limit} 首）`,
            { params: [reachedLimit.limit] }
          )
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
          preferredPlayDate: playDate,
          semester: currentSemester,
          cover: requestBody.cover || null,
          musicPlatform: isBilibili ? 'bilibili' : requestBody.musicPlatform || null,
          musicId: finalMusicId,
          musicSourceData,
          cardCodeId: providedCardCodeId || null,
          playUrl: requestBody.playUrl || null,
          durationSeconds: requestBody.durationSeconds || null,
          submissionNote,
          submissionNotePublic,
          submissionAnonymous,
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

    // 投稿后立即补齐或校验歌曲时长（不阻塞请求响应）
    const submitDuration = song.durationSeconds
    const submitPlatform = song.musicPlatform
    const submitMusicId = song.musicId
    if (submitPlatform && submitMusicId) {
      const durationValidationTask = (async () => {
        try {
          const decision = await reconcileSongDurationOnSubmit(song.id, submitPlatform, submitMusicId, submitDuration)
          if (decision.outcome === 'fill' || decision.outcome === 'clear') {
            await db.update(songs).set({ durationSeconds: decision.durationSeconds }).where(eq(songs.id, song.id))
            if (decision.outcome === 'fill') {
              console.log(`[投稿时长] #${song.id} 已补齐时长 ${decision.durationSeconds}s`)
            }
          }
        } catch (err) {
          console.error(`[投稿时长] 后台任务 #${song.id} 异常:`, err)
        }
      })()
      if (typeof event.waitUntil === 'function') {
        event.waitUntil(durationValidationTask)
      } else {
        durationValidationTask.catch((err) => console.error(`[投稿时长] 后台任务 #${song.id} 异常:`, err))
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

    // 群聊推送：谁点了什么歌。后台事件开关关闭或无群目标时该调用直接返回 0；
    // 通知失败不得影响投稿结果。
    try {
      const [requester] = await db.select({ name: users.name, username: users.username })
        .from(users).where(eq(users.id, user.id)).limit(1)
      // 匿名投稿不在群聊推送里暴露真实姓名
      const displayName =
        song.submissionAnonymous === true
          ? '匿名投稿'
          : (requester?.name || requester?.username || `用户 ${user.id}`)
      await enqueueAstrbotGroupEvent(
        'songRequest',
        '新的点歌投稿',
        `${displayName} 点了《${song.title}》- ${song.artist}`
      )
    } catch (error) {
      console.error('发送群聊点歌通知失败:', error)
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
