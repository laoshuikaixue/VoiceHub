import { defineEventHandler, readBody } from 'h3'
import { getS3UploadService } from '~~/server/services/s3UploadService'
import { createError } from 'h3'
import { z } from 'zod'

const testS3Schema = z.object({
  endpoint: z.string({ message: 'S3 端点 URL 格式不正确' }).url('S3 端点必须是以 http:// 或 https:// 开头的有效 URL'),
  bucket: z.string().min(1, '桶名称不能为空').max(255),
  accessKey: z.string().min(1, 'Access Key 不能为空').max(255),
  secretKey: z.string().min(1, 'Secret Key 不能为空').max(255),
  region: z.string().max(100).default('us-east-1'),
  s3Path: z.string().max(1000).optional()
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
  const parseResult = testS3Schema.safeParse(body)

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: `参数错误: ${parseResult.error.issues.map((e) => e.message).join(', ')}`
    })
  }

  const s3Service = getS3UploadService()
  s3Service.initialize(parseResult.data)

  const result = await s3Service.testConnection()

  let files: string[] = []
  let directories: string[] = []
  if (result.success) {
    const prefix = parseResult.data.s3Path?.replace(/^\//, '') || 'backups'
    const listResult = await s3Service.listFiles(prefix + '/')
    if (listResult.success) {
      files = listResult.files
      directories = listResult.directories
    }
  }

  return {
    success: result.success,
    message: result.success ? 'S3 连接成功' : 'S3 连接失败',
    errorMessage: result.errorMessage,
    files,
    directories
  }
})
