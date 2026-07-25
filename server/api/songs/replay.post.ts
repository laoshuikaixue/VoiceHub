import { and, db, eq, songs, songReplayRequests, semesters, playTimes } from '~/drizzle/db'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { createApiError } from '~~/server/utils/apiError'
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
    const issues = parsedBody.error.issues || []
    throw createApiError(
      400,
      'SONG_REPLAY_INVALID_REQUEST',
      issues.length
        ? `请求参数验证失败：${issues.map((issue) => issue.message).join(', ')}`
        : '请求参数验证失败'
    )
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
      throw createError({ statusCode: 400, message: '播出时段选择功能未启用' })
    }

    const playTimeResult = await db
      .select()
      .from(playTimes)
      .where(and(eq(playTimes.id, preferredPlayTimeId), eq(playTimes.enabled, true)))
      .limit(1)
    preferredPlayTime = playTimeResult[0]

    if (!preferredPlayTime) {
      throw createError({ statusCode: 400, message: '选择的播出时段不存在或未启用' })
    }
  }

  const rawSubmissionNote = parsedBody.data.submissionNote || ''
  const submissionNote = settings.enableSubmissionRemarks && rawSubmissionNote ? rawSubmissionNote : null
  const submissionNotePublic = submissionNote !== null ? parsedBody.data.submissionNotePublic !== false : false

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

  // 5. 检查是否重复申请和冷却期
  const existing = await db
    .select()
    .from(songReplayRequests)
    .where(and(eq(songReplayRequests.songId, songId), eq(songReplayRequests.userId, user.id)))
    .limit(1)

  if (existing.length > 0) {
    const existingRequest = existing[0]

    if (existingRequest.status === 'PENDING') {
      throw createApiError(400, 'SONG_REPLAY_ALREADY_REQUESTED', '您已经申请过重播该歌曲')
    }

    // REJECTED 或 FULFILLED 均可冷却 24 小时后重新申请
    const COOLDOWN_HOURS = 24
    const cooldownTime = COOLDOWN_HOURS * 60 * 60 * 1000
    const timeSinceUpdate = Date.now() - new Date(existingRequest.updatedAt).getTime()

    if (timeSinceUpdate < cooldownTime) {
      const remainingHours = Math.ceil((cooldownTime - timeSinceUpdate) / (60 * 60 * 1000))
      throw createApiError(429, 'SONG_REPLAY_COOLDOWN', `重播申请冷却中，还需等待 ${remainingHours} 小时`, { params: [remainingHours] })
    }

    // 冷却期已过，更新状态为 PENDING
    await db
      .update(songReplayRequests)
      .set({
        status: 'PENDING',
        updatedAt: new Date(),
        createdAt: new Date(),
        preferredPlayTimeId: preferredPlayTime?.id || null,
        submissionNote,
        submissionNotePublic
      })
      .where(eq(songReplayRequests.id, existingRequest.id))

    return { success: true, message: '重新申请重播成功' }
  }

  // 6. 插入申请记录
  try {
    await db.insert(songReplayRequests).values({
      songId,
      userId: user.id,
      preferredPlayTimeId: preferredPlayTime?.id || null,
      submissionNote,
      submissionNotePublic
    })
    return { success: true, message: '申请重播成功' }
  } catch (error: any) {
    // 处理唯一约束冲突
    if (error.code === '23505') {
      throw createApiError(400, 'SONG_REPLAY_ALREADY_REQUESTED', '您已经申请过重播该歌曲')
    }
    throw error
  }
})
