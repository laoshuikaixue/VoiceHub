import { and, db, eq, songs, songReplayRequests, semesters } from '~/drizzle/db'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { createApiError } from '~~/server/utils/apiError'

export default defineEventHandler(async (event) => {
  // 1. 检查用户认证
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'SONG_LOGIN_REQUIRED_REPLAY', '需要登录才能申请重播')
  }

  // 2. 读取请求体
  const body = await readBody(event)
  const { songId } = body

  if (!songId) {
    throw createApiError(400, 'SONG_ID_REQUIRED', '歌曲ID不能为空')
  }

  // 3. 检查系统设置
  const settings = await getSystemSettingsCached()
  if (!settings?.enableReplayRequests) {
    throw createApiError(403, 'SONG_REPLAY_DISABLED', '重播申请功能未开启')
  }

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
    if (existingRequest.status === 'REJECTED') {
      // 检查冷却期 (24 小时)
      const COOLDOWN_HOURS = 24
      const cooldownTime = COOLDOWN_HOURS * 60 * 60 * 1000
      const timeSinceUpdate = Date.now() - new Date(existingRequest.updatedAt).getTime()

      if (timeSinceUpdate < cooldownTime) {
        const remainingHours = Math.ceil((cooldownTime - timeSinceUpdate) / (60 * 60 * 1000))
        throw createApiError(429, 'SONG_REPLAY_REJECTED_WAIT_HOURS', `您的重播申请被拒绝后需要等待 ${remainingHours} 小时才能重新申请`, { params: [remainingHours] })
      }

      // 冷却期已过，更新状态为 PENDING
      await db
        .update(songReplayRequests)
        .set({
          status: 'PENDING',
          updatedAt: new Date(),
          createdAt: new Date()
        })
        .where(eq(songReplayRequests.id, existingRequest.id))

      return { success: true, message: '重新申请重播成功' }
    } else {
      throw createApiError(400, 'SONG_REPLAY_ALREADY_REQUESTED', '您已经申请过重播该歌曲')
    }
  }

  // 6. 插入申请记录
  try {
    await db.insert(songReplayRequests).values({
      songId,
      userId: user.id
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
