import { db } from '~/drizzle/db'
import { playTimes, schedules, songs } from '~/drizzle/schema'
import { and, count, eq, ne } from 'drizzle-orm'
import { normalizeWeekdays } from '~~/server/utils/play-slot'
import { setDefaultPlayTime } from '~~/server/utils/play-time-default'
import { isDeadlockDetected, isUniqueViolation } from '~~/server/utils/db-errors'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async (event) => {
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

    // 验证适用星期（可选）：0-6 的整数数组，空数组/不传 = 每天均可选
    if (body.weekdays !== undefined && body.weekdays !== null && !Array.isArray(body.weekdays)) {
      throw createError({
        statusCode: 400,
        message: '适用星期必须是数组（0=周日 … 6=周六）'
      })
    }
    const weekdays = normalizeWeekdays(body.weekdays)

    try {
      // 读取、推导与更新在事务内加行锁完成，避免并发下基于陈旧值误切换默认
      const updatedPlayTime = await db.transaction(async (tx) => {
        const currentResult = await tx
          .select()
          .from(playTimes)
          .where(eq(playTimes.id, id))
          .limit(1)
          .for('update')
        const current = currentResult[0]
        if (!current) {
          throw createError({
            statusCode: 404,
            message: '找不到指定的播出时段'
          })
        }

        // 省略 isDefault 时保留原值，避免旧客户端整表更新时误清默认
        const enabled = body.enabled !== undefined ? body.enabled : true
        let isDefault = body.isDefault !== undefined ? body.isDefault === true : current.isDefault
        if (!enabled) {
          // 与 PATCH 语义一致：仅显式要求「停用且设为默认」才拒绝，停用本身自动取消默认
          if (body.isDefault === true) {
            throw createApiError(
              400,
              SERVER_ERROR_CODES.PLAY_TIME_DEFAULT_REQUIRES_ENABLED,
              '已停用的播出时段不能设为默认时段'
            )
          }
          isDefault = false
        }

        // 检查名称是否已存在（排除当前ID）
        const existingPlayTimeResult = await tx
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

        // 更新播出时段；默认时段在同一事务内切换，保证同时只有一个
        const [row] = await tx
          .update(playTimes)
          .set({
            name: body.name,
            startTime: body.startTime || null,
            endTime: body.endTime || null,
            description: body.description ?? null,
            enabled,
            weekdays,
            isDefault: false
          })
          .where(eq(playTimes.id, id))
          .returning()

        if (isDefault) {
          await setDefaultPlayTime(tx, id)
          row.isDefault = true
        }

        return row
      })

      return updatedPlayTime
    } catch (error: any) {
      console.error('更新播出时段失败:', error)

      // 并发切换默认时段撞上部分唯一索引或被死锁牺牲：让调用方重试，而不是报成 500
      if (isUniqueViolation(error) || isDeadlockDetected(error)) {
        throw createApiError(
          409,
          SERVER_ERROR_CODES.PLAY_TIME_DEFAULT_CONFLICT,
          '默认播出时段正在被其他操作修改，请重试'
        )
      }

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

    // 适用星期（可选）：0-6 的整数数组，空数组 = 清除配置恢复「每天均可选」
    let weekdays: number[] | null | undefined
    if (body.weekdays !== undefined) {
      if (body.weekdays !== null && !Array.isArray(body.weekdays)) {
        throw createError({
          statusCode: 400,
          message: '适用星期必须是数组（0=周日 … 6=周六）'
        })
      }
      weekdays = normalizeWeekdays(body.weekdays)
    }

    try {
      // 读取、推导与更新在事务内加行锁完成，避免并发下基于陈旧值误切换默认
      const updatedPlayTime = await db.transaction(async (tx) => {
        const currentResult = await tx
          .select()
          .from(playTimes)
          .where(eq(playTimes.id, id))
          .limit(1)
          .for('update')
        const current = currentResult[0]
        if (!current) {
          throw createError({
            statusCode: 404,
            message: '找不到指定的播出时段'
          })
        }

        // 不变式：默认时段必须启用。停用时自动取消默认，避免留下不可用的默认值
        const enabled = body.enabled !== undefined ? body.enabled : current.enabled
        let isDefault = current.isDefault
        if (body.isDefault !== undefined) isDefault = body.isDefault === true
        if (!enabled) {
          if (body.isDefault === true) {
            throw createApiError(
              400,
              SERVER_ERROR_CODES.PLAY_TIME_DEFAULT_REQUIRES_ENABLED,
              '已停用的播出时段不能设为默认时段'
            )
          }
          isDefault = false
        }

        // 如果要更新名称，先检查是否存在重名
        if (body.name !== undefined) {
          const existingPlayTimeResult = await tx
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

        // 更新播出时段；默认时段在同一事务内切换，保证同时只有一个
        const updateData: any = {}
        if (body.name !== undefined) updateData.name = body.name
        if (body.startTime !== undefined) updateData.startTime = body.startTime
        if (body.endTime !== undefined) updateData.endTime = body.endTime
        if (body.description !== undefined) updateData.description = body.description
        if (body.enabled !== undefined) updateData.enabled = body.enabled
        if (weekdays !== undefined) updateData.weekdays = weekdays

        const [row] = await tx
          .update(playTimes)
          .set({ ...updateData, isDefault: false })
          .where(eq(playTimes.id, id))
          .returning()

        if (isDefault) {
          await setDefaultPlayTime(tx, id)
          row.isDefault = true
        }

        // defaultCleared 供前端提示：本次操作是否顺带取消了默认时段（例如停用默认时段）
        return { ...row, defaultCleared: current.isDefault && !isDefault }
      })

      return updatedPlayTime
    } catch (error: any) {
      console.error('部分更新播出时段失败:', error)

      if (isUniqueViolation(error) || isDeadlockDetected(error)) {
        throw createApiError(
          409,
          SERVER_ERROR_CODES.PLAY_TIME_DEFAULT_CONFLICT,
          '默认播出时段正在被其他操作修改，请重试'
        )
      }

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

      return {
        message: '播出时段已成功删除',
        // 删除的是默认时段时，默认值随之消失（不会自动改指其它时段）
        defaultCleared: deletedPlayTime?.isDefault === true,
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
