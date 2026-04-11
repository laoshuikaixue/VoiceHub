import { defineEventHandler, readBody } from 'h3'
import { getS3UploadService } from '~~/server/services/s3UploadService'
import { createError } from 'h3'
import { z } from 'zod'

const browseS3Schema = z.object({
  endpoint: z.string().url().max(500),
  bucket: z.string().min(1).max(255),
  accessKey: z.string().min(1).max(255),
  secretKey: z.string().min(1).max(255),
  region: z.string().max(100).default('us-east-1'),
  path: z.string().max(1000).default('backups')
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
  const result = browseS3Schema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: '参数错误: ' + result.error.message
    })
  }

  const { endpoint, bucket, accessKey, secretKey, region, path } = result.data

  const s3Service = getS3UploadService()
  s3Service.initialize({ endpoint, bucket, accessKey, secretKey, region })

  try {
    const listResult = await s3Service.listFiles(path)

    return {
      success: listResult.success,
      files: listResult.files || [],
      directories: listResult.directories || [],
      currentPath: path,
      errorMessage: listResult.errorMessage
    }
  } catch (error) {
    console.error('Browse S3 failed:', error)
    return {
      success: false,
      files: [],
      directories: [],
      currentPath: path,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})