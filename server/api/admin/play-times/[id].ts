import { db } from '~/drizzle/db'
import { CacheService } from '../../../services/cacheService'
import { playTimes, schedules, songs } from '~/drizzle/schema'
import { and, count, eq, ne } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能访问播出时段'
    })
  }

  // 获取播出时段ID
  const id = parseInt(event.context.params?.id || '0')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: '播出时段ID不正确'
    })
  }

  // 根据请求方法执行不同操作
  const method = event.method

  if (method === 'GET') {
    try {
      // 获取指定播出时段
      const playTimeResult = await db.select().from(playTimes).where(eq(playTimes.id, id)).limit(1)
      const playTime = playTimeResult[0]

      if (!playTime) {
        throw createError({
          statusCode: 404,
          message: '找不到指定的播出时段'
        })
      }

      return playTime
    } catch (error) {
      console.error('获取播出时段失败:', error)
      throw createError({
        statusCode: 500,
        message: '获取播出时段失败'
      })
    }
  } else if (method === 'PUT') {
    // 更新播出时段
    const body = await readBody(event)

    // 验证必填字段
    if (!body.name) {
      throw createError({
        statusCode: 400,
        message: '时段名称不能为空'
      })
    }

    // 验证时间格式（如果提供）
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (body.startTime && !timeRegex.test(body.startTime)) {
      throw createError({
        statusCode: 400,
        message: '开始时间格式不正确，应为HH:MM格式'
      })
    }

    if (body.endTime && !timeRegex.test(body.endTime)) {
      throw createError({
        statusCode: 400,
        message: '结束时间格式不正确，应为HH:MM格式'
      })
    }

    // 验证时间顺序（仅当两者都提供时）
    if (body.startTime && body.endTime && body.startTime >= body.endTime) {
      throw createError({
        statusCode: 400,
        message: '开始时间必须早于结束时间'
      })
    }

    try {
      // 检查名称是否已存在（排除当前ID）
      const existingPlayTimeResult = await db
        .select()
        .from(playTimes)
        .where(and(eq(playTimes.name, body.name), ne(playTimes.id, id)))
        .limit(1)
      const existingPlayTime = existingPlayTimeResult[0]

      if (existingPlayTime) {
        throw createError({
          statusCode: 400,
          message: '播出时段名称已存在，请使用其他名称'
        })
      }

      // 更新播出时段
      const updatedPlayTimeResult = await db
        .update(playTimes)
        .set({
          name: body.name,
          startTime: body.startTime || null,
          endTime: body.endTime || null,
          description: body.description ?? null,
          enabled: body.enabled !== undefined ? body.enabled : true
        })
        .where(eq(playTimes.id, id))
        .returning()
      const updatedPlayTime = updatedPlayTimeResult[0]

      // 清除相关缓存
      try {
        const cacheService = CacheService.getInstance()
        await cacheService.clearSchedulesCache()
        await cacheService.clearPlayTimesCache()
        console.log('[Cache] 排期缓存已清除（播放时间更新）')
      } catch (cacheError) {
        console.warn('[Cache] 清除缓存失败:', cacheError)
      }

      return updatedPlayTime
    } catch (error: any) {
      console.error('更新播出时段失败:', error)

      // 如果是我们自定义的错误，直接抛出
      if (error.statusCode) {
        throw error
      }

      throw createError({
        statusCode: 500,
        message: '更新播出时段失败'
      })
    }
  } else if (method === 'PATCH') {
    // 部分更新（主要用于启用/禁用）
    const body = await readBody(event)

    try {
      // 如果要更新名称，先检查是否存在重名
      if (body.name !== undefined) {
        // 检查名称是否已存在（排除当前ID）
        const existingPlayTimeResult = await db
          .select()
          .from(playTimes)
          .where(and(eq(playTimes.name, body.name), ne(playTimes.id, id)))
          .limit(1)
        const existingPlayTime = existingPlayTimeResult[0]

        if (existingPlayTime) {
          throw createError({
            statusCode: 400,
            message: '播出时段名称已存在，请使用其他名称'
          })
        }
      }

      // 更新播出时段
      const updateData: any = {}
      if (body.name !== undefined) updateData.name = body.name
      if (body.startTime !== undefined) updateData.startTime = body.startTime
      if (body.endTime !== undefined) updateData.endTime = body.endTime
      if (body.description !== undefined) updateData.description = body.description
      if (body.enabled !== undefined) updateData.enabled = body.enabled

      const updatedPlayTimeResult = await db
        .update(playTimes)
        .set(updateData)
        .where(eq(playTimes.id, id))
        .returning()
      const updatedPlayTime = updatedPlayTimeResult[0]

      // 清除相关缓存
      try {
        const cacheService = CacheService.getInstance()
        await cacheService.clearSchedulesCache()
        await cacheService.clearPlayTimesCache()
        console.log('[Cache] 排期缓存已清除（播放时间部分更新）')
      } catch (cacheError) {
        console.warn('[Cache] 清除缓存失败:', cacheError)
      }

      return updatedPlayTime
    } catch (error: any) {
      console.error('部分更新播出时段失败:', error)

      // 如果是我们自定义的错误，直接抛出
      if (error.statusCode) {
        throw error
      }

      throw createError({
        statusCode: 500,
        message: '部分更新播出时段失败'
      })
    }
  } else if (method === 'DELETE') {
    try {
      // 检查该播出时段是否有关联的歌曲或排期
      const songsCountResult = await db
        .select({ count: count() })
        .from(songs)
        .where(eq(songs.preferredPlayTimeId, id))
      const songsCount = songsCountResult[0].count

      const schedulesCountResult = await db
        .select({ count: count() })
        .from(schedules)
        .where(eq(schedules.playTimeId, id))
      const schedulesCount = schedulesCountResult[0].count

      // 删除该播出时段
      const deletedPlayTimeResult = await db
        .delete(playTimes)
        .where(eq(playTimes.id, id))
        .returning()
      const deletedPlayTime = deletedPlayTimeResult[0]

      // 如果有关联的歌曲或排期，将它们的playTimeId设为null
      if (songsCount > 0) {
        await db
          .update(songs)
          .set({ preferredPlayTimeId: null })
          .where(eq(songs.preferredPlayTimeId, id))
      }

      if (schedulesCount > 0) {
        await db.update(schedules).set({ playTimeId: null }).where(eq(schedules.playTimeId, id))
      }

      // 清除相关缓存
      try {
        const cacheService = CacheService.getInstance()
        await cacheService.clearSchedulesCache()
        await cacheService.clearPlayTimesCache()
        if (songsCount > 0) {
          await cacheService.clearSongsCache()
        }
        console.log('[Cache] 缓存已清除（播放时间删除）')
      } catch (cacheError) {
        console.warn('[Cache] 清除缓存失败:', cacheError)
      }

      return {
        message: '播出时段已成功删除',
        affected: { songs: songsCount, schedules: schedulesCount }
      }
    } catch (error) {
      console.error('删除播出时段失败:', error)
      throw createError({
        statusCode: 500,
        message: '删除播出时段失败'
      })
    }
  } else {
    throw createError({
      statusCode: 405,
      message: '不支持的请求方法'
    })
  }
})
