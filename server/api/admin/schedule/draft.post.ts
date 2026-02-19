import { db } from '~/drizzle/db'
import { playTimes, schedules, songs, songReplayRequests } from '~/drizzle/schema'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { cacheService } from '~~/server/services/cacheService'
import { getClientIP } from '~~/server/utils/ip-utils'

// 输入验证函数
function validateInput(body: any) {
  const errors: string[] = []

  // 验证songId
  if (!body.songId) {
    errors.push('歌曲ID不能为空')
  } else if (typeof body.songId !== 'number' || body.songId <= 0) {
    errors.push('歌曲ID必须是正整数')
  }

  // 验证playDate
  if (!body.playDate) {
    errors.push('播放日期不能为空')
  } else {
    const dateStr = typeof body.playDate === 'string' ? body.playDate : body.playDate.toString()
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(dateStr)) {
      errors.push('播放日期格式必须为YYYY-MM-DD')
    } else {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) {
        errors.push('播放日期格式无效')
      }
    }
  }

  // 验证sequence（可选）
  if (body.sequence !== undefined && body.sequence !== null) {
    if (typeof body.sequence !== 'number' || body.sequence <= 0) {
      errors.push('序号必须是正整数')
    }
  }

  // 验证playTimeId（可选）
  if (body.playTimeId !== undefined && body.playTimeId !== null) {
    if (typeof body.playTimeId !== 'number' || body.playTimeId <= 0) {
      errors.push('播放时间ID必须是正整数')
    }
  }

  return errors
}

export default defineEventHandler(async (event) => {
  const startTime = Date.now()
  const clientIP = getClientIP(event)

  try {
    // 检查用户认证和权限
    const user = event.context.user

    if (!user) {
      throw createError({
        statusCode: 401,
        message: '未授权访问'
      })
    }

    if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        message: '权限不足'
      })
    }

    const body = await readBody(event)

    // 输入验证
    const validationErrors = validateInput(body)
    if (validationErrors.length > 0) {
      throw createError({
        statusCode: 400,
        message: validationErrors.join('; ')
      })
    }

    // 使用数据库事务确保数据一致性
    const result = await db.transaction(async (tx) => {
      // 检查歌曲是否存在
      const songResult = await tx.select().from(songs).where(eq(songs.id, body.songId)).limit(1)

      const song = songResult[0]

      if (!song) {
        throw createError({
          statusCode: 404,
          message: '歌曲不存在'
        })
      }

      // 检查播放时间ID是否有效（如果提供）
      if (body.playTimeId) {
        const playTimeResult = await tx
          .select()
          .from(playTimes)
          .where(eq(playTimes.id, body.playTimeId))
          .limit(1)

        if (playTimeResult.length === 0) {
          throw createError({
            statusCode: 404,
            message: '播放时间不存在'
          })
        }
      }

      // 检查是否已经为该歌曲创建过排期或草稿，如果有则删除旧的
      const existingScheduleResult = await tx
        .select()
        .from(schedules)
        .where(eq(schedules.songId, body.songId))
        .limit(1)

      const existingSchedule = existingScheduleResult[0]
      if (existingSchedule) {
        // 删除现有排期或草稿
        await tx.delete(schedules).where(eq(schedules.id, existingSchedule.id))

        // 恢复该歌曲的重播申请状态为 PENDING
        // 只恢复状态为 FULFILLED 的申请
        const updatedRequests = await tx
          .update(songReplayRequests)
          .set({
            status: 'PENDING',
            updatedAt: new Date()
          })
          .where(
            and(
              eq(songReplayRequests.songId, body.songId),
              eq(songReplayRequests.status, 'FULFILLED')
            )
          )
          .returning()

        if (updatedRequests.length > 0) {
          console.log(
            `恢复了 ${updatedRequests.length} 个重播申请状态为 PENDING（草稿保存时删除旧排期）`
          )
        }
      }

      // 获取序号，如果未提供则查找当天最大序号+1
      let sequence = body.sequence || 1

      if (!body.sequence) {
        // 解析输入的日期字符串
        const inputDateStr =
          typeof body.playDate === 'string' ? body.playDate : body.playDate.toISOString()

        // 创建当天的开始和结束时间
        const startOfDay = new Date(inputDateStr + 'T00:00:00.000Z')
        const endOfDay = new Date(inputDateStr + 'T23:59:59.999Z')

        // 查找当天的所有排期和草稿（包括草稿状态的）
        const sameDaySchedules = await tx
          .select()
          .from(schedules)
          .where(and(gte(schedules.playDate, startOfDay), lte(schedules.playDate, endOfDay)))
          .orderBy(desc(schedules.sequence))
          .limit(1)

        if (sameDaySchedules.length > 0) {
          sequence = (sameDaySchedules[0].sequence || 0) + 1
        }
      }

      // 解析输入的日期字符串，确保日期正确
      const inputDateStr =
        typeof body.playDate === 'string' ? body.playDate : body.playDate.toISOString()

      // 直接使用输入的日期字符串，添加时间部分以避免时区问题
      const playDate = new Date(inputDateStr + 'T00:00:00.000Z')

      // 创建草稿排期
      const scheduleResult = await tx
        .insert(schedules)
        .values({
          songId: body.songId,
          playDate: playDate,
          sequence: sequence,
          playTimeId: body.playTimeId || null,
          isDraft: true, // 标记为草稿
          publishedAt: null // 草稿状态下没有发布时间
        })
        .returning()

      return {
        schedule: scheduleResult[0],
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          requesterId: song.requesterId
        }
      }
    })

    // 清除相关缓存（在事务外执行，避免影响事务性能）
    try {
      await cacheService.clearSchedulesCache()
      await cacheService.clearSongsCache()
      console.log('[Cache] 排期缓存和歌曲列表缓存已清除（保存草稿）')
    } catch (cacheError) {
      console.error('[Cache] 清除缓存失败:', cacheError)
      // 缓存清除失败不应该影响主要操作的成功
    }

    const responseData = {
      ...result.schedule,
      song: result.song,
      isDraft: true,
      publishedAt: null,
      message: '排期草稿保存成功'
    }

    console.log(`[Performance] 保存排期草稿耗时: ${Date.now() - startTime}ms`)

    return responseData
  } catch (error: any) {
    console.error('保存排期草稿失败:', {
      error: error.message,
      stack: error.stack,
      userId: event.context.user?.id,
      ip: clientIP,
      duration: Date.now() - startTime
    })

    // 根据错误类型返回适当的错误信息
    if (error.statusCode) {
      throw error // 重新抛出已经格式化的错误
    }

    // 对于未知错误，返回具体的错误信息
    throw createError({
      statusCode: 500,
      message: error.message || '服务器内部错误，请稍后重试'
    })
  }
})
