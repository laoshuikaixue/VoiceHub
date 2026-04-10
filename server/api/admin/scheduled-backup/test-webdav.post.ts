import { defineEventHandler, readBody } from 'h3'
import { getWebDAVUploadService } from '~~/server/services/webdavUploadService'
import { createError } from 'h3'
import { z } from 'zod'

const testWebDAVSchema = z.object({
  url: z.string().url().max(500),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(255)
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
  const parseResult = testWebDAVSchema.safeParse(body)

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: `参数错误: ${parseResult.error.errors.map((e) => e.message).join(', ')}`
    })
  }

  const webdavService = getWebDAVUploadService()
  webdavService.initialize(parseResult.data)

  const result = await webdavService.testConnection()

  return {
    success: result.success,
    message: result.success ? 'WebDAV 连接成功' : 'WebDAV 连接失败',
    errorMessage: result.errorMessage
  }
})
