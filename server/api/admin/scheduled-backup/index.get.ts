import { defineEventHandler, getQuery } from 'h3'
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

  const backupService = getBackupService()
  const scheduler = getBackupScheduler()

  const schedules = await backupService.getSchedules()

  const schedulesWithNextRun = schedules.map((schedule) => {
    const task = scheduler.getTask(schedule.id)
    return {
      ...schedule,
      nextRun: task?.nextRun || null,
      isRunning: false
    }
  })

  return {
    success: true,
    data: schedulesWithNextRun
  }
})
