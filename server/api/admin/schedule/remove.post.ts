import { db, eq, ne, schedules, songs, songReplayRequests, and } from '~/drizzle/db'
import { cacheService } from '~~/server/services/cacheService'

export default defineEventHandler(async (event) => {
  // 验证管理员权限
  const user = event.context.user
  if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要歌曲管理员及以上权限'
    })
  }

  try {
    const body = await readBody(event)
    const { scheduleId } = body

    if (!scheduleId) {
      throw createError({
        statusCode: 400,
        message: '缺少排期 ID'
      })
    }

    const scheduleIdNumber = Number(scheduleId)

    console.log(`准备删除排期 ID=${scheduleIdNumber}`)

    // 先检查排期是否存在，并获取歌曲ID
    const existingSchedule = await db
      .select({
        id: schedules.id,
        songId: schedules.songId,
        songTitle: songs.title,
        songArtist: songs.artist
      })
      .from(schedules)
      .leftJoin(songs, eq(schedules.songId, songs.id))
      .where(eq(schedules.id, scheduleIdNumber))
      .limit(1)
      .then((rows) => rows[0])

    if (!existingSchedule) {
      console.log(`排期不存在 ID=${scheduleIdNumber}`)
      return {
        success: false,
        message: '排期不存在或已被删除'
      }
    }

    console.log(`找到排期 ID=${scheduleIdNumber}, 歌曲=${existingSchedule.songTitle || '未知歌曲'}`)

    // 使用事务包装删除和重播状态更新操作
    const result = await db.transaction(async (tx) => {
      // 删除排期
      const deletedSchedule = await tx
        .delete(schedules)
        .where(eq(schedules.id, scheduleIdNumber))
        .returning()

      console.log(`成功删除排期 ID=${scheduleIdNumber}`)

      // 恢复该歌曲的重播申请状态为 PENDING
      // 只有当该歌曲没有其他正式排期（非草稿）时，才恢复重播申请状态
      if (existingSchedule.songId) {
        const otherSchedules = await tx
          .select({ id: schedules.id })
          .from(schedules)
          .where(
            and(
              eq(schedules.songId, existingSchedule.songId),
              eq(schedules.isDraft, false),
              ne(schedules.id, scheduleIdNumber)
            )
          )
          .limit(1)

        if (otherSchedules.length === 0) {
          const updatedRequests = await tx
            .update(songReplayRequests)
            .set({
              status: 'PENDING',
              updatedAt: new Date()
            })
            .where(
              and(
                eq(songReplayRequests.songId, existingSchedule.songId),
                // 不恢复已拒绝的申请
                eq(songReplayRequests.status, 'FULFILLED')
              )
            )
            .returning({ id: songReplayRequests.id })

          if (updatedRequests.length > 0) {
            console.log(`恢复了 ${updatedRequests.length} 个重播申请状态为 PENDING`)
          }
        } else {
          console.log(`该歌曲仍有其他正式排期，不恢复重播申请状态`)
        }
      }

      return deletedSchedule
    })

    // 清除相关缓存
    try {
      await cacheService.clearSchedulesCache()
      await cacheService.clearSongsCache() // 清除歌曲列表缓存，确保scheduled状态更新
      console.log('[Cache] 排期缓存和歌曲列表缓存已清除（移除排期）')
    } catch (cacheError) {
      console.error('[Cache] 清除缓存失败:', cacheError)
    }

    return {
      success: true,
      schedule: result
    }
  } catch (error: any) {
    console.error('移除排期失败:', error)

    // 处理数据库特定错误
    if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
      return {
        success: false,
        message: '排期不存在或已被删除'
      }
    }

    // 确保返回一个成功=false的响应，而不是抛出错误
    return {
      success: false,
      message: error.message || '移除排期失败',
      error: error.code || 'UNKNOWN_ERROR'
    }
  }
})
