import { defineEventHandler, readBody } from 'h3'
import { getBackupService } from '~~/server/services/backupService'
import { getBackupScheduler } from '~~/server/utils/backupScheduler'
import { createError } from 'h3'
import { z } from 'zod'

const createScheduleSchema = z.object({
  name: z.string().min(1).max(255),
  enabled: z.boolean().default(true),
  scheduleType: z.enum(['daily', 'weekly', 'monthly', 'cron']),
  scheduleTime: z.string().optional(),
  scheduleDay: z.number().int().min(0).max(31).optional(),
  cronExpression: z.string().max(100).optional(),
  backupType: z.enum(['all', 'users']).default('all'),
  includeSystemData: z.boolean().default(true),
  uploadEnabled: z.boolean().default(false),
  uploadType: z.enum(['s3', 'webdav']).optional(),
  s3Endpoint: z.string().max(500).optional(),
  s3Bucket: z.string().max(255).optional(),
  s3AccessKey: z.string().max(255).optional(),
  s3SecretKey: z.string().max(255).optional(),
  s3Region: z.string().max(100).optional(),
  webdavUrl: z.string().max(500).optional(),
  webdavUsername: z.string().max(255).optional(),
  webdavPassword: z.string().max(255).optional(),
  retentionType: z.enum(['days', 'count']).optional(),
  retentionValue: z.number().int().positive().default(7)
})

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '权限不足'
    })
  }

  const body = await readBody(event)

  const parseResult = createScheduleSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: `参数错误: ${parseResult.error.errors.map((e) => e.message).join(', ')}`
    })
  }

  const data = parseResult.data

  if (data.scheduleType !== 'cron' && !data.scheduleTime) {
    throw createError({
      statusCode: 400,
      message: '请指定调度时间'
    })
  }

  if (data.scheduleType === 'cron' && !data.cronExpression) {
    throw createError({
      statusCode: 400,
      message: '请指定 cron 表达式'
    })
  }

  if (data.uploadEnabled && !data.uploadType) {
    throw createError({
      statusCode: 400,
      message: '请选择上传类型（S3 或 WebDAV）'
    })
  }

  if (data.uploadType === 's3') {
    if (!data.s3Endpoint || !data.s3Bucket || !data.s3AccessKey || !data.s3SecretKey) {
      throw createError({
        statusCode: 400,
        message: '请完整填写 S3 配置信息'
      })
    }
  }

  if (data.uploadType === 'webdav') {
    if (!data.webdavUrl || !data.webdavUsername || !data.webdavPassword) {
      throw createError({
        statusCode: 400,
        message: '请完整填写 WebDAV 配置信息'
      })
    }
  }

  const backupService = getBackupService()
  const scheduler = getBackupScheduler()

  const schedule = await backupService.createSchedule({
    ...data,
    createdBy: user.id
  })

  scheduler.addTask({
    id: schedule.id,
    name: schedule.name,
    scheduleType: schedule.scheduleType as 'daily' | 'weekly' | 'monthly' | 'cron',
    scheduleTime: schedule.scheduleTime || undefined,
    scheduleDay: schedule.scheduleDay || undefined,
    cronExpression: schedule.cronExpression || undefined,
    enabled: schedule.enabled,
    callback: async () => {
      console.log(`[API] Executing scheduled backup: ${schedule.name} (ID: ${schedule.id})`)
    }
  })

  return {
    success: true,
    data: schedule
  }
})
