import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { getBackupService } from '~~/server/services/backupService'
import { getBackupScheduler } from '~~/server/utils/backupScheduler'
import { createError } from 'h3'
import { z } from 'zod'

const toggleSchema = z.object({
  enabled: z.boolean()
})

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

  const body = await readBody(event)
  const parseResult = toggleSchema.safeParse(body)

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: '参数错误'
    })
  }

  const backupService = getBackupService()

  const existingSchedule = await backupService.getSchedule(id)
  if (!existingSchedule) {
    throw createError({
      statusCode: 404,
      message: '备份配置不存在'
    })
  }

  const enabled = parseResult.data.enabled
  await backupService.setScheduleEnabled(id, enabled)

  return {
    success: true,
    message: enabled ? '备份已启用' : '备份已禁用'
  }
})
