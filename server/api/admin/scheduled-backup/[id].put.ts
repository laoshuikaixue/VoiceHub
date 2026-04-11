import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { getBackupService } from '~~/server/services/backupService'
import { getBackupScheduler } from '~~/server/utils/backupScheduler'
import { createError } from 'h3'
import { z } from 'zod'

const updateScheduleSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(255).optional(),
  enabled: z.boolean().optional(),
  includeSongs: z.boolean().optional(),
  includeUsers: z.boolean().optional(),
  includeSystemData: z.boolean().optional(),
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
}).superRefine((data, ctx) => {
  if (data.uploadType === 's3' && (data.s3Endpoint || data.s3Bucket || data.s3AccessKey || data.s3SecretKey)) {
    if (!data.s3Endpoint) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'S3 Endpoint 不能为空' })
    if (!data.s3Bucket) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'S3 Bucket 不能为空' })
    if (!data.s3AccessKey) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'S3 Access Key 不能为空' })
    if (!data.s3SecretKey) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'S3 Secret Key 不能为空' })
  } else if (data.uploadType === 'webdav' && (data.webdavUrl || data.webdavUsername || data.webdavPassword)) {
    if (!data.webdavUrl) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'WebDAV URL 不能为空' })
    if (!data.webdavUsername) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'WebDAV 用户名不能为空' })
    if (!data.webdavPassword) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'WebDAV 密码不能为空' })
  }
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

  const parseResult = updateScheduleSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: `参数错误: ${parseResult.error.issues.map((e) => e.message).join(', ')}`
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

  const updatedSchedule = await backupService.updateSchedule(id, parseResult.data)

  return {
    success: true,
    data: updatedSchedule
  }
})
