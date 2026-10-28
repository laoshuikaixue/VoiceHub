import { db } from '~/drizzle/db'
import { playTimes } from '~/drizzle/schema'
import { ilike } from 'drizzle-orm'
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
      message: '只有管理员才能添加播出时段'
    })
  }

  // 获取请求体
  const body = await readBody(event)

  // 验证必填字段
  if (!body.name) {
    throw createError({
      statusCode: 400,
      message: '时段名称不能为空'
    })
  }

  // 验证时间格式（如果提供了时间）
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
  const weekdays = normalizeWeekdays(body.weekdays)
  if (body.weekdays !== undefined && body.weekdays !== null && !Array.isArray(body.weekdays)) {
    throw createError({
      statusCode: 400,
      message: '适用星期必须是数组（0=周日 … 6=周六）'
    })
  }

  // 默认时段必须可用：停用的时段不参与用户选择，设为默认没有意义
  const isDefault = body.isDefault === true
  const enabled = body.enabled !== undefined ? body.enabled : true
  if (isDefault && !enabled) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.PLAY_TIME_DEFAULT_REQUIRES_ENABLED,
      '已停用的播出时段不能设为默认时段'
    )
  }

  try {
    // 检查名称是否已存在
    const existingPlayTimeResult = await db
      .select()
      .from(playTimes)
      .where(ilike(playTimes.name, body.name))
      .limit(1)
    const existingPlayTime = existingPlayTimeResult[0]

    if (existingPlayTime) {
      throw createError({
        statusCode: 400,
        message: '播出时段名称已存在，请使用其他名称'
      })
    }

    // 创建新的播出时段；默认时段在事务内切换，保证同时只有一个
    const newPlayTime = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(playTimes)
        .values({
          name: body.name,
          startTime: body.startTime || null,
          endTime: body.endTime || null,
          description: body.description || null,
          enabled,
          weekdays,
          isDefault: false
        })
        .returning()

      if (!isDefault) return created

      await setDefaultPlayTime(tx, created.id)
      return { ...created, isDefault: true }
    })

    return newPlayTime
  } catch (error: any) {
    console.error('创建播出时段失败:', error)

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
      message: '创建播出时段失败'
    })
  }
})
