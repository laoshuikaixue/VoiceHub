import { defineEventHandler, getRouterParam } from 'h3'
import { getBackupService } from '~~/server/services/backupService'
import { getBackupScheduler } from '~~/server/utils/backupScheduler'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '权限不足'
    })
  }

  const id = parseInt(getRouterParam(event, 'id') || '0')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: '无效的调度 ID'
    })
  }

  const backupService = getBackupService()
  const scheduler = getBackupScheduler()

  const existingSchedule = await backupService.getSchedule(id)
  if (!existingSchedule) {
    throw createError({
      statusCode: 404,
      message: '调度不存在'
    })
  }

  scheduler.removeTask(id)
  await backupService.deleteSchedule(id)

  return {
    success: true,
    message: '调度已删除'
  }
})
