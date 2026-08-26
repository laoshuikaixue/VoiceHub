import { db } from '~/drizzle/db'
import {
  songs,
  users,
  songCollaborators,
  collaborationLogs,
  songReplayRequests
} from '~/drizzle/schema'
import { eq, or, and } from 'drizzle-orm'
import { createSubmissionNoteClearedNotification } from '~~/server/services/notificationService'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES, SUBMISSION_NOTE_STATUS } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'
import { getClientIP } from '~~/server/utils/ip-utils'

export default defineEventHandler(async (event) => {
  try {
    // 验证请求方法
    if (event.node.req.method !== 'PUT') {
      throw createApiError(405, 'HTTP_METHOD_NOT_ALLOWED', 'Method Not Allowed')
    }

    // 获取已验证的用户信息（由中间件提供）
    const user = event.context.user
    if (!user) {
      throw createApiError(401, 'AUTH_UNAUTHORIZED_ACCESS', '未授权访问')
    }

    // 检查权限
    if (!['ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createApiError(403, 'COMMON_INSUFFICIENT_PERMISSION', '权限不足')
    }

    // 获取歌曲ID
    const songId = parseInt(getRouterParam(event, 'id'))
    if (!songId) {
      throw createApiError(400, SERVER_ERROR_CODES.SONG_INVALID_ID, 'Invalid song ID')
    }

    // 获取请求体
    const body = await readBody(event)
    const {
      title,
      artist,
      requester,
      semester,
      musicPlatform,
      musicId,
      cover,
      playUrl,
      preferredPlayTimeId,
      durationSeconds
    } = body
    const ipAddress = getClientIP(event)

    // 验证必填字段
    if (!title || !artist) {
      throw createApiError(400, SERVER_ERROR_CODES.SONG_TITLE_ARTIST_REQUIRED, 'Title and artist are required')
    }

    // 校验时长范围（0秒~2小时，允许管理员输入任意合理值，后台会二次校验）
    if (durationSeconds !== null && durationSeconds !== undefined) {
      const d = Number(durationSeconds)
      if (!Number.isFinite(d) || d < 0 || d > 7200) {
        throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, 'Invalid song duration (0s–2h)')
      }
    }

    const existingSongResult = await db.select().from(songs).where(eq(songs.id, songId)).limit(1)
    const existingSong = existingSongResult[0]

    if (!existingSong) {
      throw createApiError(404, 'SONG_NOT_FOUND', '歌曲不存在')
    }

    const updateData: Partial<typeof songs.$inferInsert> = {
      title: title.trim(),
      artist: artist.trim()
    }

    if (body.semester !== undefined) updateData.semester = body.semester || null
    if (body.preferredPlayTimeId !== undefined)
      updateData.preferredPlayTimeId = body.preferredPlayTimeId || null
    if (body.musicPlatform !== undefined) updateData.musicPlatform = body.musicPlatform || null
    if (body.musicId !== undefined) updateData.musicId = body.musicId || null
    if (body.cover !== undefined) updateData.cover = body.cover || null
    if (body.playUrl !== undefined) updateData.playUrl = body.playUrl || null
    if (durationSeconds !== undefined) updateData.durationSeconds = durationSeconds ?? null

    // 处理投稿人
    if ('requester' in body) {
      const requester = body.requester

      // 只有在传递有效投稿人信息时才更新
      if (requester && requester !== '' && requester !== 0) {
        // 查找投稿人用户
        const conditions = []
        if (typeof requester === 'number') {
          conditions.push(eq(users.id, requester))
        }
        if (typeof requester === 'string') {
          conditions.push(eq(users.username, requester))
          conditions.push(eq(users.name, requester))
        }

        const requesterUser = await db
          .select()
          .from(users)
          .where(or(...conditions))
          .limit(1)

        if (requesterUser.length === 0) {
          throw createApiError(404, 'SONG_REQUESTER_NOT_FOUND', '投稿人用户不存在')
        }

        // 设置投稿人
        updateData.requesterId = requesterUser[0].id
      }
      // 如果投稿人为空值，则跳过处理，保持原有投稿人不变
    }

    const shouldClearSubmissionNote = body.clearSubmissionNote === true
    const submissionNoteClearReason =
      typeof body.submissionNoteClearReason === 'string'
        ? body.submissionNoteClearReason.trim()
        : ''
    const shouldNotifySubmissionNoteClear = body.notifyOnSubmissionNoteClear === true

    if (shouldClearSubmissionNote) {
      updateData.submissionNote = null
      // 清空备注时同步撤销公开与审核状态
      updateData.submissionNotePublic = false
      updateData.submissionNotePublicStatus = null
    } else if ('submissionNote' in body) {
      updateData.submissionNote =
        typeof body.submissionNote === 'string' && body.submissionNote.trim()
          ? body.submissionNote.trim()
          : null
    }

    if ('submissionNotePublicStatus' in body) {
      // 公开留言审核动作：approved=通过并公开；rejected=拒绝；null=撤销公开；其他值返回 400
      const st = body.submissionNotePublicStatus
      if (st === 'approved') {
        updateData.submissionNotePublic = true
        updateData.submissionNotePublicStatus = SUBMISSION_NOTE_STATUS.APPROVED
      } else if (st === 'rejected') {
        updateData.submissionNotePublic = false
        updateData.submissionNotePublicStatus = SUBMISSION_NOTE_STATUS.REJECTED
      } else if (st === null || st === undefined) {
        updateData.submissionNotePublic = false
        updateData.submissionNotePublicStatus = null
      } else {
        throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '无效的公开留言审核状态')
      }
    } else if ('submissionNotePublic' in body) {
      // 兼容旧语义：置 true 视为通过审核，置 false 视为撤销公开
      const notePublic = body.submissionNotePublic === true
      updateData.submissionNotePublic = notePublic
      updateData.submissionNotePublicStatus = notePublic ? SUBMISSION_NOTE_STATUS.APPROVED : null
    }

    const currentRequesterId = updateData.requesterId || existingSong.requesterId

    // 如果指定了 replayRequestId 且本次携带备注可见性变更，则更新对应重播申请（条件更新，避免隐性重置）
    let replaySet: Record<string, unknown> | null = null
    if ('replayRequestId' in body) {
      const replayRequestId = body.replayRequestId ? Number(body.replayRequestId) : null
      const hasNoteVisibilityChange =
        'submissionNotePublicStatus' in body || 'submissionNotePublic' in body
      if (body.replayRequestId !== null && body.replayRequestId !== undefined &&
        (!Number.isInteger(replayRequestId) || replayRequestId <= 0)) {
        throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '重播申请 ID 无效')
      }
      if (replayRequestId && hasNoteVisibilityChange) {
        replaySet = { updatedAt: getServerDate() }
        if ('submissionNotePublicStatus' in body) {
          const st = body.submissionNotePublicStatus
          if (st === 'approved') {
            replaySet.submissionNotePublic = true
            replaySet.submissionNotePublicStatus = SUBMISSION_NOTE_STATUS.APPROVED
          } else if (st === 'rejected') {
            replaySet.submissionNotePublic = false
            replaySet.submissionNotePublicStatus = SUBMISSION_NOTE_STATUS.REJECTED
          } else if (st === null || st === undefined) {
            replaySet.submissionNotePublic = false
            replaySet.submissionNotePublicStatus = null
          } else {
            throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '无效的公开留言审核状态')
          }
        } else {
          const notePublic = body.submissionNotePublic === true
          replaySet.submissionNotePublic = notePublic
          replaySet.submissionNotePublicStatus = notePublic ? SUBMISSION_NOTE_STATUS.APPROVED : null
        }
        delete updateData.submissionNotePublic
        delete updateData.submissionNotePublicStatus
      }
    }

    // 歌曲更新与重播申请更新放入同一事务，保证一致性
    const updatedSongResult = await db.transaction(async (tx) => {
      if (replaySet) {
        const replayRequestId = body.replayRequestId ? Number(body.replayRequestId) : null
        const replayResult = await tx
          .update(songReplayRequests)
          .set(replaySet)
          .where(
            and(eq(songReplayRequests.id, replayRequestId), eq(songReplayRequests.songId, songId))
          )
          .returning({ id: songReplayRequests.id })
        if (replayResult.length === 0) {
          throw createApiError(404, SERVER_ERROR_CODES.COMMON_TARGET_NOT_FOUND, '重播申请不存在')
        }
      }
      const result = await tx
        .update(songs)
        .set(updateData)
        .where(eq(songs.id, songId))
        .returning()
      return result[0]
    })

    // 处理联合投稿人
    if ('collaborators' in body && Array.isArray(body.collaborators)) {
      // 获取现有联合投稿人
      const existingCollaborators = await db
        .select()
        .from(songCollaborators)
        .where(eq(songCollaborators.songId, songId))

      const existingCollaboratorUserIds = existingCollaborators.map((c) => c.userId)
      const newCollaboratorIds = [
        ...new Set(
          body.collaborators
            .map((id: number | string) => Number(id))
            .filter((id: number) => Number.isInteger(id) && id > 0 && id !== currentRequesterId)
        )
      ]

      // 需要添加的
      const toAdd = newCollaboratorIds.filter(
        (id: number) => !existingCollaboratorUserIds.includes(id)
      )
      // 需要删除的
      const toDelete = existingCollaborators.filter((c) => !newCollaboratorIds.includes(c.userId))

      // 执行添加
      for (const userId of toAdd) {
        // 检查用户是否存在
        const userExists = await db.select().from(users).where(eq(users.id, userId)).limit(1)
        if (userExists.length > 0) {
          const [newCollab] = await db
            .insert(songCollaborators)
            .values({
              songId: songId,
              userId: userId,
              status: 'ACCEPTED'
            })
            .returning()

          // 记录日志
          await db.insert(collaborationLogs).values({
            collaboratorId: newCollab.id,
            action: 'ADMIN_ADD',
            operatorId: user.id,
            ipAddress
          })
        }
      }

      // 执行删除
      for (const collab of toDelete) {
        await db.delete(songCollaborators).where(eq(songCollaborators.id, collab.id))

        // 记录日志
        await db.insert(collaborationLogs).values({
          collaboratorId: collab.id,
          action: 'ADMIN_REMOVE',
          operatorId: user.id,
          ipAddress
        })
      }
    }

    if (
      shouldClearSubmissionNote &&
      existingSong.submissionNote &&
      shouldNotifySubmissionNoteClear
    ) {
      const latestCollaborators = await db
        .select({
          userId: songCollaborators.userId
        })
        .from(songCollaborators)
        .where(eq(songCollaborators.songId, songId))

      const notifyUserIds = [
        currentRequesterId,
        ...latestCollaborators.map((collaborator) => collaborator.userId)
      ].filter((userId): userId is number => Number.isInteger(userId) && userId > 0)

      createSubmissionNoteClearedNotification(
        notifyUserIds,
        { title: updatedSongResult.title, artist: updatedSongResult.artist },
        submissionNoteClearReason
      ).catch((error) => {
        console.error('发送歌曲备注清空通知失败:', error)
      })
    }

    // 获取完整的歌曲信息（包含投稿人）
    const updatedSong = await db
      .select({
        id: songs.id,
        title: songs.title,
        artist: songs.artist,
        semester: songs.semester,
        musicPlatform: songs.musicPlatform,
        musicId: songs.musicId,
        cover: songs.cover,
        playUrl: songs.playUrl,
        durationSeconds: songs.durationSeconds,
        submissionNote: songs.submissionNote,
        submissionNotePublic: songs.submissionNotePublic,
        requesterId: songs.requesterId,
        createdAt: songs.createdAt,
        updatedAt: songs.updatedAt,
        requester: {
          id: users.id,
          username: users.username,
          name: users.name
        }
      })
      .from(songs)
      .leftJoin(users, eq(songs.requesterId, users.id))
      .where(eq(songs.id, songId))
      .limit(1)

    return {
      success: true,
      song: updatedSong[0]
    }
  } catch (error) {
    console.error('Update song error:', error)

    // 业务错误（带 statusCode）直接透传
    if (error?.statusCode) {
      throw error
    }

    // 非业务错误（数据库连接等）包装为统一的 500 错误码
    throw createApiError(
      500,
      SERVER_ERROR_CODES.AUTH_SYSTEM_ERROR,
      error?.message || 'Internal server error'
    )
  }
})
