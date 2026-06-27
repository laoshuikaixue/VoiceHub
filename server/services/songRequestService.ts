import {
  collaborationLogs,
  db,
  playTimes,
  requestTimes,
  semesters,
  cardCodes,
  songCollaborators,
  songs,
  systemSettings
} from '~/drizzle/db'
import { and, eq, gt, lt, lte, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { createCollaborationInvitationNotification } from '~~/server/services/notificationService'
import { isLimitReached } from '~~/server/utils/submissionLimit'
import { getBeijingTimeISOString } from '~/utils/timeUtils'

type SongRequestUser = {
  id: number
  role: string
}

export async function requestSongForUser(event: any, user: SongRequestUser, body: any) {
  if (!body.title || !body.artist) {
    throw createError({
      statusCode: 400,
      message: '歌曲名称和艺术家不能为空'
    })
  }

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

    const normalizedTitle = normalizeForMatch(body.title)
    const normalizedArtist = normalizeForMatch(body.artist)

    const currentSemester = await getCurrentSemesterName()

    const isBilibili =
      body.musicPlatform === 'bilibili' ||
      String(body.musicId || '').startsWith('BV') ||
      String(body.musicId || '').startsWith('av')

    if (isBilibili && body.musicId) {
      let fullMusicId = String(body.musicId)
      const bvId = fullMusicId.split(':')[0]

      if (body.bilibiliCid) {
        const musicIdParts = [bvId, body.bilibiliCid]
        if (body.bilibiliPage && Number(body.bilibiliPage) > 1) {
          musicIdParts.push(String(body.bilibiliPage))
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
            message: `《${body.title}》已经在列表中，不能重复投稿`
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
            message: `《${body.title}》已经在列表中，不能重复投稿`
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
      const providedCardCode = typeof body.cardCode === 'string' ? body.cardCode.trim().toUpperCase() : ''
      if (!providedCardCode) {
        throw createError({ statusCode: 403, message: '本站点已启用仅点歌券投稿，请提供有效点歌券' })
      }
    }

    const isCardCodeEnabled = !!(
      systemSettingsData?.enableCardCodeRequests || systemSettingsData?.requireCardCodeForRequests
    )
    if (typeof body.cardCode === 'string' && body.cardCode.trim() && !isCardCodeEnabled && !isAdmin) {
      throw createError({ statusCode: 400, message: '点歌券投稿功能未启用' })
    }

    let preferredPlayTime = null
    if (body.preferredPlayTimeId) {
      if (!systemSettingsData?.enablePlayTimeSelection) {
        throw createError({
          statusCode: 400,
          message: '播出时段选择功能未启用'
        })
      }

      const playTimeResult = await db
        .select()
        .from(playTimes)
        .where(and(eq(playTimes.id, body.preferredPlayTimeId), eq(playTimes.enabled, true)))
        .limit(1)
      preferredPlayTime = playTimeResult[0]

      if (!preferredPlayTime) {
        throw createError({
          statusCode: 400,
          message: '选择的播出时段不存在或未启用'
        })
      }
    }

    const rawSubmissionNote = typeof body.submissionNote === 'string' ? body.submissionNote.trim() : ''
    if (rawSubmissionNote.length > 300) {
      throw createError({
        statusCode: 400,
        message: '备注留言不能超过300个字符'
      })
    }
    const submissionNote =
      systemSettingsData?.enableSubmissionRemarks && rawSubmissionNote ? rawSubmissionNote : null
    const submissionNotePublic = submissionNote !== null ? body.submissionNotePublic !== false : false

    const notificationsToSend: { userId: number; songId: number; songTitle: string }[] = []

    const song = await db.transaction(async (tx) => {
      let providedCardCodeId: number | null = null
      const providedCardCode = typeof body.cardCode === 'string' ? body.cardCode.trim().toUpperCase() : ''

      if (providedCardCode) {
        const codeRows = await tx
          .select()
          .from(cardCodes)
          .where(eq(cardCodes.code, providedCardCode))
          .limit(1)

        const found = codeRows[0]
        if (!found || found.status !== 'AVAILABLE') {
          throw createError({ statusCode: 400, message: '点歌券无效或已被使用' })
        }

        const lockResult = await tx
          .update(cardCodes)
          .set({ status: 'LOCKED', lockedBy: user.id, lockedAt: new Date() })
          .where(and(eq(cardCodes.id, found.id), eq(cardCodes.status, 'AVAILABLE')))
          .returning()

        if (lockResult.length === 0) {
          throw createError({ statusCode: 400, message: '点歌券已被锁定或不可用' })
        }

        providedCardCodeId = found.id
      }

      if (
        systemSettingsData?.enableSubmissionLimit &&
        !isAdmin &&
        effectiveLimit &&
        effectiveLimit > 0 &&
        limitType
      ) {
        if (await isLimitReached(tx as any, user.id, limitType, effectiveLimit)) {
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

      let finalMusicId = body.musicId ? String(body.musicId) : null

      if (isBilibili) {
        const bvId = finalMusicId?.split(':')[0]
        if (bvId) {
          const musicIdParts = [bvId]
          if (body.bilibiliCid) {
            musicIdParts.push(body.bilibiliCid)
            if (body.bilibiliPage && Number(body.bilibiliPage) > 1) {
              musicIdParts.push(String(body.bilibiliPage))
            }
          }
          finalMusicId = musicIdParts.join(':')
        }
      }

      const songResult = await tx
        .insert(songs)
        .values({
          title: body.title,
          artist: body.artist,
          requesterId: user.id,
          preferredPlayTimeId: preferredPlayTime?.id || null,
          semester: currentSemester,
          cover: body.cover || null,
          musicPlatform: isBilibili ? 'bilibili' : body.musicPlatform || null,
          musicId: finalMusicId,
          cardCodeId: providedCardCodeId || null,
          playUrl: body.playUrl || null,
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
        body.collaborators &&
        Array.isArray(body.collaborators) &&
        body.collaborators.length > 0
      ) {
        const collaboratorIds = body.collaborators.map((id: any) => Number(id)) as number[]
        const uniqueCollaboratorIds = [...new Set<number>(collaboratorIds)]

        for (const collaboratorId of uniqueCollaboratorIds) {
          if (isNaN(collaboratorId) || collaboratorId === user.id) continue

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
              ipAddress:
                (event.node.req.headers['x-forwarded-for'] as string) ||
                event.node.req.socket.remoteAddress
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
