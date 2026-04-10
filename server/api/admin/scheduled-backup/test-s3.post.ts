import { defineEventHandler, readBody } from 'h3'
import { getS3UploadService } from '~~/server/services/s3UploadService'
import { createError } from 'h3'
import { z } from 'zod'

const testS3Schema = z.object({
  endpoint: z.string().url().max(500),
  bucket: z.string().min(1).max(255),
  accessKey: z.string().min(1).max(255),
  secretKey: z.string().min(1).max(255),
  region: z.string().max(100).default('us-east-1')
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
      message: `参数错误: ${parseResult.error.errors.map((e) => e.message).join(', ')}`
    })
  }

  const s3Service = getS3UploadService()
  s3Service.initialize(parseResult.data)

  const result = await s3Service.testConnection()

  return {
    success: result.success,
    message: result.success ? 'S3 连接成功' : 'S3 连接失败',
    errorMessage: result.errorMessage
  }
})
