import { defineEventHandler, getQuery } from 'h3'
import { getBackupService } from '~~/server/services/backupService'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '权限不足'
    })
  }

  const query = getQuery(event)
  const scheduleId = query.scheduleId ? parseInt(query.scheduleId as string) : undefined
  const limit = query.limit ? parseInt(query.limit as string) : 50
  const offset = query.offset ? parseInt(query.offset as string) : 0

  const backupService = getBackupService()
  const result = await backupService.getBackupHistory({
    scheduleId,
    limit,
    offset
  })

  return {
    success: true,
    data: result.records,
    total: result.total,
    limit,
    offset
  }
})
