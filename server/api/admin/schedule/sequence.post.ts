import { db, eq } from '~/drizzle/db'
import { schedules } from '~/drizzle/schema'
import { canWriteSchedule } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  // 权限：schedule.write（SONG_ADMIN 及以上）；未登录 401 / 账号异常 403 / 缺权限 403
  await canWriteSchedule(event)

  try {
    const body = await readBody(event)
    const scheduleUpdates = body.schedules

    if (!Array.isArray(scheduleUpdates) || scheduleUpdates.length === 0) {
      throw createError({
        statusCode: 400,
        message: '缺少排期数据'
      })
    }

    const normalizedUpdates = scheduleUpdates.map((item: any, index: number) => {
      const id = Number(item?.id)
      const sequence = Number(item?.sequence)
      if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(sequence) || sequence <= 0) {
        throw createError({ statusCode: 400, message: `第 ${index + 1} 条排期数据无效` })
      }
      return { id, sequence }
    })

    // 批量更新排期顺序
    const results = await db.transaction(async (tx) => {
      const updatedRows = await Promise.all(
        normalizedUpdates.map((item) =>
          tx
            .update(schedules)
            .set({ sequence: item.sequence })
            .where(eq(schedules.id, item.id))
            .returning({ id: schedules.id })
        )
      )

      if (updatedRows.some((rows) => rows.length === 0)) {
        throw createError({ statusCode: 404, message: '部分排期不存在，请刷新后重试' })
      }

      return updatedRows
    })

    return {
      success: true,
      count: results.length
    }
  } catch (error: any) {
    console.error('更新排期顺序失败:', error)

    if (error.statusCode) throw error

    throw createError({
      statusCode: 500,
      message: error.message || '更新排期顺序失败'
    })
  }
})
