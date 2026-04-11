import { defineEventHandler, readBody } from 'h3'
import { getWebDAVUploadService } from '~~/server/services/webdavUploadService'
import { createError } from 'h3'
import { z } from 'zod'

const testWebDAVSchema = z.object({
  url: z.string({ message: 'WebDAV URL 格式不正确' }).url('WebDAV URL 必须是以 http:// 或 https:// 开头的有效 URL'),
  username: z.string().min(1, '用户名不能为空').max(255),
  password: z.string().min(1, '密码不能为空').max(255)
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
      message: `参数错误: ${parseResult.error.issues.map((e) => e.message).join(', ')}`
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
