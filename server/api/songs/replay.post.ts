import { and, db, desc, eq, songs, songReplayRequests, semesters, playTimes } from '~/drizzle/db'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { createApiError } from '~~/server/utils/apiError'
import { SUBMISSION_NOTE_STATUS } from '~~/server/config/constants'
import { z } from 'zod'

const replayRequestSchema = z.object({
  songId: z.number().int().gt(0, '歌曲ID无效'),
  submissionNote: z.string().trim().max(300, '备注留言不能超过300个字符').optional().nullable(),
  submissionNotePublic: z.boolean().optional(),
  preferredPlayTimeId: z.number().int().gt(0, '播出时段 ID 无效').optional().nullable()
})

export default defineEventHandler(async (event) => {
  // 1. 检查用户认证
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'SONG_LOGIN_REQUIRED_REPLAY', '需要登录才能申请重播')
  }

  // 2. 读取请求体
  const body = await readBody(event)
  const parsedBody = replayRequestSchema.safeParse(body || {})
  if (!parsedBody.success) {
    const issueText = (parsedBody.error.issues || []).map((issue) => issue.message).join(', ')
    throw createApiError(400, 'USER_REQUEST_VALIDATION_FAILED', `请求参数验证失败：${issueText}`, {
      params: [issueText]
    })
  }

  const { songId, preferredPlayTimeId } = parsedBody.data

  // 3. 检查系统设置
  const settings = await getSystemSettingsCached()
  if (!settings?.enableReplayRequests) {
    throw createApiError(403, 'SONG_REPLAY_DISABLED', '重播申请功能未开启')
  }

  let preferredPlayTime = null
  if (preferredPlayTimeId) {
    if (!settings.enablePlayTimeSelection) {
      throw createApiError(400, 'SONG_REPLAY_PLAY_TIME_DISABLED', '播出时段选择功能未启用')
    }

    const playTimeResult = await db
      .select()
      .from(playTimes)
      .where(and(eq(playTimes.id, preferredPlayTimeId), eq(playTimes.enabled, true)))
      .limit(1)
    preferredPlayTime = playTimeResult[0]

    if (!preferredPlayTime) {
      throw createApiError(400, 'SONG_REPLAY_PLAY_TIME_INVALID', '选择的播出时段不存在或未启用')
    }
  }

  const rawSubmissionNote = parsedBody.data.submissionNote || ''
  const submissionNote = settings.enableSubmissionRemarks && rawSubmissionNote ? rawSubmissionNote : null
  // 公开留言审核：开关开启时申请留言不立即公开，进入待审后由管理员通过
  const noteRequiresApproval = settings.submissionNoteRequiresApproval === true
  const wantsPublic = submissionNote !== null ? parsedBody.data.submissionNotePublic !== false : false
  const submissionNotePublic = noteRequiresApproval ? false : wantsPublic
  // 仅用户勾选公开的留言进入审核，私密留言只供管理员查看
  const submissionNotePublicStatus =
    noteRequiresApproval && submissionNote !== null && wantsPublic
      ? SUBMISSION_NOTE_STATUS.PENDING
      : null

  // 4. 检查歌曲和学期
  const songResult = await db.select().from(songs).where(eq(songs.id, songId)).limit(1)
  const song = songResult[0]
  if (!song) {
    throw createApiError(404, 'SONG_NOT_FOUND', '歌曲不存在')
  }
  if (!song.played) {
    throw createApiError(400, 'SONG_NOT_PLAYED_NO_REPLAY', '该歌曲尚未播放，无法申请重播')
  }

  // 获取当前学期
  const currentSemesterResult = await db
    .select()
    .from(semesters)
    .where(eq(semesters.isActive, true))
    .limit(1)
  const currentSemester = currentSemesterResult[0]

  // 验证学期
  if (currentSemester) {
    if (song.semester !== currentSemester.name) {
      throw createApiError(400, 'SONG_REPLAY_CURRENT_SEMESTER_ONLY', '只能申请重播当前学期的歌曲')
    }
  } else {
    throw createApiError(400, 'SONG_NO_ACTIVE_SEMESTER_REPLAY', '当前没有活跃学期，无法申请重播')
  }

  // 5. 检查重复申请和冷却期（insert-only：历史申请不覆写，每次申请新增一条记录）
  const latestRequestResult = await db
    .select()
    .from(songReplayRequests)
    .where(and(eq(songReplayRequests.songId, songId), eq(songReplayRequests.userId, user.id)))
    .orderBy(desc(songReplayRequests.createdAt))
    .limit(1)
  const latestRequest = latestRequestResult[0]

  if (latestRequest) {
    if (latestRequest.status === 'PENDING') {
      throw createApiError(400, 'SONG_REPLAY_ALREADY_REQUESTED', '您已经申请过重播该歌曲')
    }

    // REJECTED 或 FULFILLED 均需冷却 24 小时后才能再次申请
    const COOLDOWN_HOURS = 24
    const cooldownTime = COOLDOWN_HOURS * 60 * 60 * 1000
    const timeSinceUpdate = Date.now() - new Date(latestRequest.updatedAt).getTime()

    if (timeSinceUpdate < cooldownTime) {
      const remainingHours = Math.ceil((cooldownTime - timeSinceUpdate) / (60 * 60 * 1000))
      throw createApiError(429, 'SONG_REPLAY_COOLDOWN', `重播申请冷却中，还需等待 ${remainingHours} 小时`, { params: [remainingHours] })
    }
  }

  // 6. 插入申请记录
  try {
    await db.insert(songReplayRequests).values({
      songId,
      userId: user.id,
      preferredPlayTimeId: preferredPlayTime?.id || null,
      submissionNote,
      submissionNotePublic,
      submissionNotePublicStatus
    })
    return { success: true, message: latestRequest ? '重新申请重播成功' : '申请重播成功' }
  } catch (error: any) {
    // 并发提交时命中待处理申请的部分唯一索引
    if (error.code === '23505') {
      throw createApiError(400, 'SONG_REPLAY_ALREADY_REQUESTED', '您已经申请过重播该歌曲')
    }
    throw error
  }
})
