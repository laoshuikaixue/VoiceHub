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
      message: '无效的备份配置 ID'
    })
  }

  const backupService = getBackupService()

  const schedule = await backupService.getSchedule(id)

  if (!schedule) {
    throw createError({
      statusCode: 404,
      message: '备份配置不存在'
    })
  }

  return {
    success: true,
    data: schedule
  }
})
