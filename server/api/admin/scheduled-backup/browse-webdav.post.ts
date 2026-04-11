import { defineEventHandler, readBody } from 'h3'
import { getWebDAVUploadService } from '~~/server/services/webdavUploadService'
import { createError } from 'h3'
import { z } from 'zod'

const browseSchema = z.object({
  url: z.string().url().max(500),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(255),
  path: z.string().max(1000).default('/backups')
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
  const result = browseSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: '参数错误: ' + result.error.message
    })
  }

  const { url, username, password, path } = result.data

  const webdavService = getWebDAVUploadService()
  webdavService.initialize({ url, username, password })

  try {
    const listResult = await webdavService.listFiles(path)

    return {
      success: listResult.success,
      files: listResult.files || [],
      currentPath: path,
      errorMessage: listResult.errorMessage
    }
  } catch (error) {
    console.error('Browse WebDAV failed:', error)
    return {
      success: false,
      files: [],
      currentPath: path,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
