import { defineEventHandler, getRouterParam } from 'h3'
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

  const id = parseInt(getRouterParam(event, 'id') || '0')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: '无效的历史记录 ID'
    })
  }

  const backupService = getBackupService()
  const success = await backupService.deleteBackupHistory(id)

  if (!success) {
    throw createError({
      statusCode: 404,
      message: '历史记录不存在'
    })
  }

  return {
    success: true,
    message: '历史记录已删除'
  }
})
