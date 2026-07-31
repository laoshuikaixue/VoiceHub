import { defineEventHandler, readBody } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { uploadToS3, deleteFromS3 } from '~~/server/utils/s3Client'
import { getAutoBackupConfig } from '~~/server/services/autoBackupService'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '只有超级管理员可以测试 S3 连接')
  }

  const body = await readBody(event)
  let { endpoint, bucket, region, accessKey, secretKey } = body

  // 密钥为空时从已保存配置中获取
  if (!secretKey) {
    const config = await getAutoBackupConfig()
    secretKey = config?.methods?.s3?.secretKey || ''
    accessKey = accessKey || config?.methods?.s3?.accessKey || ''
    endpoint = endpoint || config?.methods?.s3?.endpoint || ''
    bucket = bucket || config?.methods?.s3?.bucket || ''
    region = region || config?.methods?.s3?.region || 'auto'
  }

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少必要参数：endpoint, bucket, accessKey, secretKey')
  }

  const testKey = '.voicehub-test-connection'

  try {
    await uploadToS3(
      endpoint,
      bucket,
      region || 'auto',
      accessKey,
      secretKey,
      testKey,
      'VoiceHub S3 connection test',
      'text/plain'
    )

    // 清理测试文件
    await deleteFromS3(
      endpoint,
      bucket,
      region || 'auto',
      accessKey,
      secretKey,
      testKey
    ).catch(() => {})

    return { success: true, message: 'S3 连接测试成功' }
  } catch (err: any) {
    return { success: false, message: err.message || 'S3 连接测试失败' }
  }
})