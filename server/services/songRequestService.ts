import {
  collaborationLogs,
  db,
  playTimes,
  requestTimes,
  semesters,
  cardCodes,
  songCollaborators,
  songs,
  systemSettings,
  users
} from '~/drizzle/db'
import { and, eq, gt, inArray, lt, lte, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { createCollaborationInvitationNotification } from '~~/server/services/notificationService'
import {
  isCardCodeLimitBypassActive,
  isLimitReached
} from '~~/server/utils/submissionLimit'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getBeijingTimeISOString } from '~/utils/timeUtils'
import { z } from 'zod'

type SongRequestUser = {
  id: number
  role: string
}

const createCardCodeError = (statusCode: number, code: string, message: string) =>
  createError({
    statusCode,
    statusMessage: code,
    message,
    data: { code }
  })

const songRequestBodySchema = z.object({
  title: z.string().trim().min(1, '歌曲名称不能为空').max(200, '歌曲名称不能超过200个字符'),
  artist: z.string().trim().min(1, '艺术家不能为空').max(200, '艺术家不能超过200个字符'),
  cover: z.string().trim().max(1000, '封面地址不能超过1000个字符').optional().nullable(),
  musicPlatform: z.string().trim().max(50, '音乐平台标识不能超过50个字符').optional().nullable(),
  musicId: z.string().trim().max(200, '音乐 ID 不能超过200个字符').optional().nullable(),
  bilibiliCid: z.string().trim().max(100, 'Bilibili CID 不能超过100个字符').optional().nullable(),
  bilibiliPage: z.union([z.string(), z.number()]).optional().nullable(),
  playUrl: z.string().trim().max(2000, '播放链接不能超过2000个字符').optional().nullable(),
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
      throw createCardCodeError(400, cardCodeIssue.message, 'Invalid request card')
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
    const normalizeForMatch = (str: string): string => {
      return str
        .toLowerCase()
        .replace(/[\s\-_\(\)\[\]【】（）「」『』《》〈〉""''""''、，。！？：；～·]/g, '')
        .replace(/[&＆]/g, 'and')
        .replace(/[feat\.?|ft\.?]/gi, '')
        .trim()
    }

    const normalizedTitle = normalizeForMatch(requestBody.title)
    const normalizedArtist = normalizeForMatch(requestBody.artist)

    const currentSemester = await getCurrentSemesterName()

    const isBilibili =
      requestBody.musicPlatform === 'bilibili' ||
      String(requestBody.musicId || '').startsWith('BV') ||
      String(requestBody.musicId || '').startsWith('av')

    if (isBilibili && requestBody.musicId) {
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
        const isSuperAdmin = user.role === 'SUPER_ADMIN'
        const hasUnplayedDuplicate = existingSongs.some((s) => !s.played)
        if (!isSuperAdmin || hasUnplayedDuplicate) {
          throw createError({
            statusCode: 400,
            message: `《${requestBody.title}》已经在列表中，不能重复投稿`
          })
        }
      }
    } else {
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
        const isSuperAdmin = user.role === 'SUPER_ADMIN'
        const hasUnplayedDuplicate = matchingSongs.some((s) => !s.played)
        if (!isSuperAdmin || hasUnplayedDuplicate) {
          throw createError({
            statusCode: 400,
            message: `《${requestBody.title}》已经在列表中，不能重复投稿`
          })
        }
      }
    }

    const systemSettingsResult = await db.select().from(systemSettings).limit(1)
    const systemSettingsData = systemSettingsResult[0]
    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'

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

    if (systemSettingsData?.requireCardCodeForRequests && !isAdmin) {
      const providedCardCode = requestBody.cardCode ? requestBody.cardCode.trim().toUpperCase() : ''
      if (!providedCardCode) {
        throw createCardCodeError(
          403,
          'CARD_CODE_REQUIRED_FOR_SITE',
          'This site requires a valid request card to submit songs'
        )
      }
    }

    const isCardCodeEnabled = !!(
      systemSettingsData?.enableCardCodeRequests || systemSettingsData?.requireCardCodeForRequests
    )
    const excludeCardCodeRequestsFromLimit = isCardCodeLimitBypassActive(systemSettingsData)
    if (requestBody.cardCode && requestBody.cardCode.trim() && !isCardCodeEnabled && !isAdmin) {
      throw createCardCodeError(400, 'CARD_CODE_DISABLED', 'Request card submissions are not enabled')
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
          throw createCardCodeError(
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
          throw createCardCodeError(
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
          submissionNote,
          submissionNotePublic,
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
