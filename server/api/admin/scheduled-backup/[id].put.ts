import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { getBackupService } from '~~/server/services/backupService'
import { getBackupScheduler } from '~~/server/utils/backupScheduler'
import { createError } from 'h3'
import { z } from 'zod'

const updateScheduleSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(255).optional(),
  enabled: z.boolean().optional(),
  scheduleType: z.enum(['daily', 'weekly', 'monthly', 'cron']).optional(),
  scheduleTime: z.string().optional(),
  scheduleDay: z.number().int().min(0).max(31).optional(),
  cronExpression: z.string().max(100).optional(),
  backupType: z.enum(['all', 'users']).optional(),
  includeSystemData: z.boolean().optional(),
  uploadEnabled: z.boolean().optional(),
  uploadType: z.enum(['s3', 'webdav']).optional(),
  s3Endpoint: z.string().max(500).optional(),
  s3Bucket: z.string().max(255).optional(),
  s3AccessKey: z.string().max(255).optional(),
  s3SecretKey: z.string().max(255).optional(),
  s3Region: z.string().max(100).optional(),
  s3Path: z.string().max(1000).optional(),
  webdavUrl: z.string().max(500).optional(),
  webdavUsername: z.string().max(255).optional(),
  webdavPassword: z.string().max(255).optional(),
  webdavPath: z.string().max(1000).optional(),
  retentionType: z.enum(['days', 'count']).optional(),
  retentionValue: z.number().int().positive().optional()
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
      message: '无效的调度 ID'
    })
  }

  const body = await readBody(event)

  const parseResult = updateScheduleSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: `参数错误: ${parseResult.error.issues.map((e) => e.message).join(', ')}`
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

  const updatedSchedule = await backupService.updateSchedule(id, parseResult.data)

  if (updatedSchedule) {
    scheduler.updateTask({
      id: updatedSchedule.id,
      name: updatedSchedule.name,
      scheduleType: updatedSchedule.scheduleType as 'daily' | 'weekly' | 'monthly' | 'cron',
      scheduleTime: updatedSchedule.scheduleTime || undefined,
      scheduleDay: updatedSchedule.scheduleDay || undefined,
      cronExpression: updatedSchedule.cronExpression || undefined,
      enabled: updatedSchedule.enabled,
      callback: async () => {
        console.log(`[API] Executing scheduled backup: ${updatedSchedule.name} (ID: ${updatedSchedule.id})`)
      }
    })
  }

  return {
    success: true,
    data: updatedSchedule
  }
})
